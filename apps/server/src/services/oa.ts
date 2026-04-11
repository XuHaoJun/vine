import { and, eq, ilike, or, sql } from 'drizzle-orm'
import type { NodePgDatabase } from 'drizzle-orm/node-postgres'
import type { Pool } from 'pg'
import type { schema } from '@vine/db'
import {
  oaProvider,
  officialAccount,
  oaWebhook,
  oaAccessToken,
  oaFriendship,
} from '@vine/db/schema-oa'
import { createHmac, randomBytes, randomUUID } from 'crypto'

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
  }
}

export type { OADeps }
