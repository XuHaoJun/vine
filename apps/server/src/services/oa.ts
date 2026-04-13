import { and, eq, ilike, inArray, or, sql } from 'drizzle-orm'
import type { NodePgDatabase } from 'drizzle-orm/node-postgres'
import type { Pool } from 'pg'
import type { schema } from '@vine/db'
import {
  oaProvider,
  officialAccount,
  oaWebhook,
  oaAccessToken,
  oaFriendship,
  oaRichMenu,
  oaRichMenuAlias,
  oaRichMenuUserLink,
  oaDefaultRichMenu,
} from '@vine/db/schema-oa'
import { createHmac, randomBytes, randomUUID } from 'crypto'
import { chat, chatMember, message } from '@vine/db/schema-public'
import { FLEX_SIMULATOR_OA_UNIQUE_ID } from '@vine/db/constants'

type OADeps = {
  db: NodePgDatabase<typeof schema>
  database: Pool
}

export function createOAService(deps: OADeps) {
  const { db } = deps

  async function createProvider(input: { name: string; ownerId: string }) {
    const [provider] = await db
      .insert(oaProvider)
      .values({
        name: input.name,
        ownerId: input.ownerId,
      })
      .returning()
    return provider
  }

  async function getProvider(id: string) {
    const [provider] = await db
      .select()
      .from(oaProvider)
      .where(eq(oaProvider.id, id))
      .limit(1)
    return provider ?? null
  }

  async function updateProvider(id: string, input: { name?: string }) {
    const [provider] = await db
      .update(oaProvider)
      .set({
        name: input.name,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(oaProvider.id, id))
      .returning()
    return provider
  }

  async function deleteProvider(id: string) {
    await db.delete(oaProvider).where(eq(oaProvider.id, id))
  }

  async function listProviderAccounts(providerId: string) {
    return db
      .select()
      .from(officialAccount)
      .where(eq(officialAccount.providerId, providerId))
  }

  async function listMyProviders(ownerId: string) {
    return db.select().from(oaProvider).where(eq(oaProvider.ownerId, ownerId))
  }

  function generateChannelSecret() {
    return randomBytes(32).toString('hex')
  }

  async function createOfficialAccount(input: {
    providerId: string
    name: string
    uniqueId: string
    description?: string
    imageUrl?: string
  }) {
    const [account] = await db
      .insert(officialAccount)
      .values({
        providerId: input.providerId,
        name: input.name,
        uniqueId: input.uniqueId,
        description: input.description,
        imageUrl: input.imageUrl,
        channelSecret: generateChannelSecret(),
      })
      .returning()
    return account
  }

  async function getOfficialAccount(id: string) {
    const [account] = await db
      .select()
      .from(officialAccount)
      .where(eq(officialAccount.id, id))
      .limit(1)
    return account ?? null
  }

  async function findOfficialAccountByUniqueId(uniqueId: string) {
    const [account] = await db
      .select({
        id: officialAccount.id,
        name: officialAccount.name,
        uniqueId: officialAccount.uniqueId,
        description: officialAccount.description,
        imageUrl: officialAccount.imageUrl,
      })
      .from(officialAccount)
      .where(eq(officialAccount.uniqueId, uniqueId))
      .limit(1)
    return account ?? null
  }

  async function updateOfficialAccount(
    id: string,
    input: { name?: string; description?: string; imageUrl?: string; status?: string },
  ) {
    const [account] = await db
      .update(officialAccount)
      .set({
        name: input.name,
        description: input.description,
        imageUrl: input.imageUrl,
        status: input.status,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(officialAccount.id, id))
      .returning()
    return account
  }

  async function deleteOfficialAccount(id: string) {
    await db.delete(officialAccount).where(eq(officialAccount.id, id))
  }

  async function setWebhook(oaId: string, url: string) {
    const [webhook] = await db
      .insert(oaWebhook)
      .values({
        oaId,
        url,
        status: 'pending',
      })
      .onConflictDoUpdate({
        target: oaWebhook.oaId,
        set: { url, status: 'pending', lastVerifiedAt: null },
      })
      .returning()
    return webhook
  }

  async function getWebhook(oaId: string) {
    const [webhook] = await db
      .select()
      .from(oaWebhook)
      .where(eq(oaWebhook.oaId, oaId))
      .limit(1)
    return webhook
  }

  function generateAccessToken() {
    return randomUUID().replace(/-/g, '') + randomBytes(16).toString('hex')
  }

  function generateKeyId() {
    return randomUUID()
  }

  async function issueAccessToken(input: {
    oaId: string
    type: 'short_lived' | 'jwt_v21'
    publicKey?: string
  }) {
    const token = generateAccessToken()
    const keyId = input.type === 'jwt_v21' ? generateKeyId() : undefined
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()

    await db.insert(oaAccessToken).values({
      oaId: input.oaId,
      token,
      type: input.type,
      keyId,
      expiresAt,
    })

    return {
      access_token: token,
      expires_in: 2592000,
      token_type: 'Bearer' as const,
      key_id: keyId,
    }
  }

  async function listAccessTokens(oaId: string, keyId?: string) {
    const conditions = [eq(oaAccessToken.oaId, oaId)]
    if (keyId) {
      conditions.push(eq(oaAccessToken.keyId, keyId))
    }
    return db
      .select({
        id: oaAccessToken.id,
        type: oaAccessToken.type,
        keyId: oaAccessToken.keyId,
        expiresAt: oaAccessToken.expiresAt,
        createdAt: oaAccessToken.createdAt,
      })
      .from(oaAccessToken)
      .where(and(...conditions))
  }

  async function revokeAccessToken(tokenId: string) {
    await db.delete(oaAccessToken).where(eq(oaAccessToken.id, tokenId))
  }

  async function revokeAllAccessTokens(oaId: string, keyId: string) {
    const result = await db
      .delete(oaAccessToken)
      .where(and(eq(oaAccessToken.oaId, oaId), eq(oaAccessToken.keyId, keyId)))
      .returning({ id: oaAccessToken.id })
    return { revoked_count: result.length }
  }

  function generateWebhookSignature(body: string, channelSecret: string) {
    return createHmac('SHA256', channelSecret).update(body).digest('base64')
  }

  function generateReplyToken() {
    return randomUUID().replace(/-/g, '')
  }

  function buildMessageEvent(input: {
    oaId: string
    userId: string
    messageId: string
    text: string
    replyToken: string
  }) {
    return {
      destination: input.oaId,
      events: [
        {
          type: 'message',
          mode: 'active' as const,
          timestamp: Date.now(),
          source: { type: 'user' as const, userId: input.userId },
          webhookEventId: randomUUID(),
          deliveryContext: { isRedelivery: false },
          replyToken: input.replyToken,
          message: {
            type: 'text' as const,
            id: input.messageId,
            text: input.text,
          },
        },
      ],
    }
  }

  function buildFollowEvent(input: { oaId: string; userId: string; replyToken: string }) {
    return {
      destination: input.oaId,
      events: [
        {
          type: 'follow',
          mode: 'active' as const,
          timestamp: Date.now(),
          source: { type: 'user' as const, userId: input.userId },
          webhookEventId: randomUUID(),
          deliveryContext: { isRedelivery: false },
          replyToken: input.replyToken,
          follow: { isUnblocked: false },
        },
      ],
    }
  }

  function buildUnfollowEvent(input: { oaId: string; userId: string }) {
    return {
      destination: input.oaId,
      events: [
        {
          type: 'unfollow',
          mode: 'active' as const,
          timestamp: Date.now(),
          source: { type: 'user' as const, userId: input.userId },
          webhookEventId: randomUUID(),
          deliveryContext: { isRedelivery: false },
        },
      ],
    }
  }

  async function searchOAs(query: string) {
    const searchPattern = `%${query}%`
    return db
      .select({
        id: officialAccount.id,
        name: officialAccount.name,
        uniqueId: officialAccount.uniqueId,
        description: officialAccount.description,
        imageUrl: officialAccount.imageUrl,
      })
      .from(officialAccount)
      .where(
        or(
          ilike(officialAccount.name, searchPattern),
          ilike(officialAccount.uniqueId, searchPattern),
        ),
      )
      .limit(20)
  }

  async function searchOAsForOwner(ownerId: string, query: string) {
    const searchPattern = `%${query}%`
    return db
      .select({
        id: officialAccount.id,
        name: officialAccount.name,
        uniqueId: officialAccount.uniqueId,
        description: officialAccount.description,
        imageUrl: officialAccount.imageUrl,
      })
      .from(officialAccount)
      .innerJoin(oaProvider, eq(officialAccount.providerId, oaProvider.id))
      .where(
        and(
          eq(oaProvider.ownerId, ownerId),
          or(
            ilike(officialAccount.name, searchPattern),
            ilike(officialAccount.uniqueId, searchPattern),
          ),
        ),
      )
      .limit(20)
  }

  async function recommendOfficialAccounts(limit: number = 15) {
    return db
      .select({
        id: officialAccount.id,
        name: officialAccount.name,
        uniqueId: officialAccount.uniqueId,
        description: officialAccount.description,
        imageUrl: officialAccount.imageUrl,
      })
      .from(officialAccount)
      .where(eq(officialAccount.status, 'active'))
      .orderBy(sql`RANDOM()`)
      .limit(limit)
  }

  async function addOAFriend(userId: string, oaId: string) {
    const account = await getOfficialAccount(oaId)
    if (!account) return { success: false, reason: 'oa_not_found' as const }

    const [existing] = await db
      .select()
      .from(oaFriendship)
      .where(and(eq(oaFriendship.oaId, account.id), eq(oaFriendship.userId, userId)))
      .limit(1)

    if (existing) return { success: false, reason: 'already_friend' as const }

    const [friendship] = await db
      .insert(oaFriendship)
      .values({
        oaId: account.id,
        userId,
        status: 'friend',
      })
      .returning()

    return {
      success: true as const,
      friendship,
      account,
    }
  }

  async function removeOAFriend(userId: string, oaId: string) {
    const account = await getOfficialAccount(oaId)
    if (!account) return { success: false, reason: 'oa_not_found' as const }

    await db
      .delete(oaFriendship)
      .where(and(eq(oaFriendship.oaId, account.id), eq(oaFriendship.userId, userId)))

    return { success: true as const }
  }

  async function listMyOAFriends(userId: string) {
    return db
      .select({
        id: oaFriendship.id,
        oaId: oaFriendship.oaId,
        uniqueId: officialAccount.uniqueId,
        name: officialAccount.name,
        imageUrl: officialAccount.imageUrl,
        status: oaFriendship.status,
        createdAt: oaFriendship.createdAt,
      })
      .from(oaFriendship)
      .innerJoin(officialAccount, eq(oaFriendship.oaId, officialAccount.id))
      .where(eq(oaFriendship.userId, userId))
  }

  async function isOAFriend(userId: string, oaId: string) {
    const account = await getOfficialAccount(oaId)
    if (!account) return false

    const [existing] = await db
      .select()
      .from(oaFriendship)
      .where(and(eq(oaFriendship.oaId, account.id), eq(oaFriendship.userId, userId)))
      .limit(1)

    return !!existing
  }

  async function simulatorSendFlexMessage(userId: string, flexJson: string) {
    const flexSimOA = await findOfficialAccountByUniqueId(FLEX_SIMULATOR_OA_UNIQUE_ID)
    if (!flexSimOA) {
      return { success: false, reason: 'oa_not_found' as const }
    }

    const [existingFriendship] = await db
      .select()
      .from(oaFriendship)
      .where(and(eq(oaFriendship.oaId, flexSimOA.id), eq(oaFriendship.userId, userId)))
      .limit(1)

    if (!existingFriendship) {
      return { success: false, reason: 'not_friend' as const }
    }

    const messageId = randomUUID()
    const sentAt = new Date().toISOString()

    const chatId = await db.transaction(async (tx) => {
      const userChatSubquery = tx
        .select({ chatId: chatMember.chatId })
        .from(chatMember)
        .where(eq(chatMember.userId, userId))

      const [existingChat] = await tx
        .select({ id: chat.id })
        .from(chat)
        .innerJoin(chatMember, eq(chatMember.chatId, chat.id))
        .where(
          and(
            eq(chat.type, 'oa'),
            inArray(chat.id, userChatSubquery),
            eq(chatMember.oaId, flexSimOA.id),
          ),
        )
        .limit(1)

      if (existingChat) {
        return existingChat.id
      }

      const newChatId = randomUUID()
      const now = new Date().toISOString()
      await tx.insert(chat).values({ id: newChatId, type: 'oa', createdAt: now })
      await tx.insert(chatMember).values([
        { id: randomUUID(), chatId: newChatId, userId, joinedAt: now },
        { id: randomUUID(), chatId: newChatId, oaId: flexSimOA.id, joinedAt: now },
      ])

      return newChatId
    })

    await db.insert(message).values({
      id: messageId,
      chatId,
      senderType: 'oa',
      oaId: flexSimOA.id,
      type: 'flex',
      metadata: flexJson,
      createdAt: sentAt,
    })

    await db
      .update(chat)
      .set({ lastMessageId: messageId, lastMessageAt: sentAt })
      .where(eq(chat.id, chatId))

    return { success: true as const, chatId }
  }

  async function sendOAMessage(
    oaId: string,
    userId: string,
    msg: {
      type: string
      text?: string | null
      metadata?: string | null
    },
  ) {
    const messageId = randomUUID()
    const sentAt = new Date().toISOString()

    const chatId = await db.transaction(async (tx) => {
      const userChatSubquery = tx
        .select({ chatId: chatMember.chatId })
        .from(chatMember)
        .where(eq(chatMember.userId, userId))

      const [existingChat] = await tx
        .select({ id: chat.id })
        .from(chat)
        .innerJoin(chatMember, eq(chatMember.chatId, chat.id))
        .where(
          and(
            eq(chat.type, 'oa'),
            inArray(chat.id, userChatSubquery),
            eq(chatMember.oaId, oaId),
          ),
        )
        .limit(1)

      if (existingChat) {
        return existingChat.id
      }

      const newChatId = randomUUID()
      const now = new Date().toISOString()
      await tx.insert(chat).values({ id: newChatId, type: 'oa', createdAt: now })
      await tx.insert(chatMember).values([
        { id: randomUUID(), chatId: newChatId, userId, joinedAt: now },
        { id: randomUUID(), chatId: newChatId, oaId, joinedAt: now },
      ])

      return newChatId
    })

    await db.insert(message).values({
      id: messageId,
      chatId,
      senderType: 'oa',
      oaId,
      type: msg.type as typeof message.$inferInsert.type,
      text: msg.text,
      metadata: msg.metadata,
      createdAt: sentAt,
    })

    await db
      .update(chat)
      .set({ lastMessageId: messageId, lastMessageAt: sentAt })
      .where(eq(chat.id, chatId))

    return { success: true as const, chatId, messageId }
  }

  async function getAccessTokenById(id: string) {
    const [row] = await db
      .select()
      .from(oaAccessToken)
      .where(eq(oaAccessToken.id, id))
      .limit(1)
    return row ?? null
  }

  async function verifyWebhook(oaId: string) {
    const webhook = await getWebhook(oaId)
    if (!webhook) return { success: false, status: 'no_webhook' as const }

    const account = await getOfficialAccount(oaId)
    if (!account) return { success: false, status: 'oa_not_found' as const }

    try {
      const response = await fetch(webhook.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'x-line-signature': generateWebhookSignature('[]', account.channelSecret),
        },
        body: JSON.stringify({ destination: oaId, events: [] }),
        signal: AbortSignal.timeout(10000),
      })

      if (response.ok) {
        await db
          .update(oaWebhook)
          .set({ status: 'verified', lastVerifiedAt: new Date().toISOString() })
          .where(eq(oaWebhook.oaId, oaId))
        return { success: true, status: 'verified' as const }
      }

      await db.update(oaWebhook).set({ status: 'failed' }).where(eq(oaWebhook.oaId, oaId))
      return { success: false, status: 'failed' as const }
    } catch {
      await db.update(oaWebhook).set({ status: 'failed' }).where(eq(oaWebhook.oaId, oaId))
      return { success: false, status: 'failed' as const }
    }
  }

  function generateRichMenuId() {
    return 'richmenu-' + randomUUID().replace(/-/g, '').substring(0, 32)
  }

  async function createRichMenu(input: {
    oaId: string
    name: string
    chatBarText: string
    selected: boolean
    sizeWidth: number
    sizeHeight: number
    areas: unknown[]
  }) {
    const richMenuId = generateRichMenuId()
    const [menu] = await db
      .insert(oaRichMenu)
      .values({
        oaId: input.oaId,
        richMenuId,
        name: input.name,
        chatBarText: input.chatBarText,
        selected: input.selected ? 'true' : 'false',
        sizeWidth: String(input.sizeWidth),
        sizeHeight: String(input.sizeHeight),
        areas: JSON.stringify(input.areas),
        hasImage: 'false',
      })
      .returning()
    return menu
  }

  async function getRichMenu(oaId: string, richMenuId: string) {
    const [menu] = await db
      .select()
      .from(oaRichMenu)
      .where(and(eq(oaRichMenu.oaId, oaId), eq(oaRichMenu.richMenuId, richMenuId)))
      .limit(1)
    return menu ?? null
  }

  async function getRichMenuList(oaId: string) {
    return db.select().from(oaRichMenu).where(eq(oaRichMenu.oaId, oaId))
  }

  async function deleteRichMenu(oaId: string, richMenuId: string) {
    await db
      .delete(oaRichMenu)
      .where(and(eq(oaRichMenu.oaId, oaId), eq(oaRichMenu.richMenuId, richMenuId)))
  }

  async function setRichMenuImage(oaId: string, richMenuId: string, hasImage: boolean) {
    await db
      .update(oaRichMenu)
      .set({ hasImage: hasImage ? 'true' : 'false', updatedAt: new Date().toISOString() })
      .where(and(eq(oaRichMenu.oaId, oaId), eq(oaRichMenu.richMenuId, richMenuId)))
  }

  async function setDefaultRichMenu(oaId: string, richMenuId: string) {
    await db
      .insert(oaDefaultRichMenu)
      .values({
        oaId,
        richMenuId,
        updatedAt: new Date().toISOString(),
      })
      .onConflictDoUpdate({
        target: oaDefaultRichMenu.oaId,
        set: { richMenuId, updatedAt: new Date().toISOString() },
      })
  }

  async function getDefaultRichMenu(oaId: string) {
    const [result] = await db
      .select()
      .from(oaDefaultRichMenu)
      .where(eq(oaDefaultRichMenu.oaId, oaId))
      .limit(1)
    return result ?? null
  }

  async function clearDefaultRichMenu(oaId: string) {
    await db.delete(oaDefaultRichMenu).where(eq(oaDefaultRichMenu.oaId, oaId))
  }

  async function linkRichMenuToUser(oaId: string, userId: string, richMenuId: string) {
    await db
      .insert(oaRichMenuUserLink)
      .values({
        oaId,
        userId,
        richMenuId,
      })
      .onConflictDoUpdate({
        target: [oaRichMenuUserLink.userId, oaRichMenuUserLink.oaId],
        set: { richMenuId, createdAt: new Date().toISOString() },
      })
  }

  async function unlinkRichMenuFromUser(oaId: string, userId: string) {
    await db
      .delete(oaRichMenuUserLink)
      .where(
        and(eq(oaRichMenuUserLink.oaId, oaId), eq(oaRichMenuUserLink.userId, userId)),
      )
  }

  async function unlinkAllRichMenuFromUsers(oaId: string) {
    await db.delete(oaRichMenuUserLink).where(eq(oaRichMenuUserLink.oaId, oaId))
  }

  async function getRichMenuIdOfUser(oaId: string, userId: string) {
    const [result] = await db
      .select()
      .from(oaRichMenuUserLink)
      .where(
        and(eq(oaRichMenuUserLink.oaId, oaId), eq(oaRichMenuUserLink.userId, userId)),
      )
      .limit(1)
    return result ?? null
  }

  async function createRichMenuAlias(input: {
    oaId: string
    richMenuAliasId: string
    richMenuId: string
  }) {
    const [alias] = await db
      .insert(oaRichMenuAlias)
      .values({
        oaId: input.oaId,
        richMenuAliasId: input.richMenuAliasId,
        richMenuId: input.richMenuId,
      })
      .returning()
    return alias
  }

  async function updateRichMenuAlias(input: {
    oaId: string
    richMenuAliasId: string
    richMenuId: string
  }) {
    const [alias] = await db
      .update(oaRichMenuAlias)
      .set({ richMenuId: input.richMenuId, updatedAt: new Date().toISOString() })
      .where(
        and(
          eq(oaRichMenuAlias.oaId, input.oaId),
          eq(oaRichMenuAlias.richMenuAliasId, input.richMenuAliasId),
        ),
      )
      .returning()
    return alias ?? null
  }

  async function deleteRichMenuAlias(oaId: string, richMenuAliasId: string) {
    await db
      .delete(oaRichMenuAlias)
      .where(
        and(
          eq(oaRichMenuAlias.oaId, oaId),
          eq(oaRichMenuAlias.richMenuAliasId, richMenuAliasId),
        ),
      )
  }

  async function getRichMenuAlias(oaId: string, richMenuAliasId: string) {
    const [alias] = await db
      .select()
      .from(oaRichMenuAlias)
      .where(
        and(
          eq(oaRichMenuAlias.oaId, oaId),
          eq(oaRichMenuAlias.richMenuAliasId, richMenuAliasId),
        ),
      )
      .limit(1)
    return alias ?? null
  }

  async function getRichMenuAliasList(oaId: string) {
    return db.select().from(oaRichMenuAlias).where(eq(oaRichMenuAlias.oaId, oaId))
  }

  return {
    createProvider,
    getProvider,
    updateProvider,
    deleteProvider,
    listMyProviders,
    listProviderAccounts,
    createOfficialAccount,
    getOfficialAccount,
    updateOfficialAccount,
    deleteOfficialAccount,
    setWebhook,
    getWebhook,
    issueAccessToken,
    listAccessTokens,
    revokeAccessToken,
    revokeAllAccessTokens,
    generateWebhookSignature,
    generateReplyToken,
    buildMessageEvent,
    buildFollowEvent,
    buildUnfollowEvent,
    searchOAs,
    searchOAsForOwner,
    recommendOfficialAccounts,
    addOAFriend,
    removeOAFriend,
    listMyOAFriends,
    isOAFriend,
    getAccessTokenById,
    verifyWebhook,
    findOfficialAccountByUniqueId,
    simulatorSendFlexMessage,
    sendOAMessage,
    createRichMenu,
    getRichMenu,
    getRichMenuList,
    deleteRichMenu,
    setRichMenuImage,
    setDefaultRichMenu,
    getDefaultRichMenu,
    clearDefaultRichMenu,
    linkRichMenuToUser,
    unlinkRichMenuFromUser,
    unlinkAllRichMenuFromUsers,
    getRichMenuIdOfUser,
    createRichMenuAlias,
    updateRichMenuAlias,
    deleteRichMenuAlias,
    getRichMenuAlias,
    getRichMenuAliasList,
  }
}

export type { OADeps }
