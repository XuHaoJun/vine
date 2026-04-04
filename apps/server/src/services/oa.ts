import { eq } from 'drizzle-orm'
import type { NodePgDatabase } from 'drizzle-orm/node-postgres'
import type { Pool } from 'pg'
import type { schema } from '@vine/db'
import {
  oaProvider,
  officialAccount,
  oaWebhook,
  oaAccessToken,
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

  function generateChannelSecret() {
    return randomBytes(32).toString('hex')
  }

  async function createOfficialAccount(input: {
    providerId: string
    name: string
    oaId: string
    description?: string
    imageUrl?: string
  }) {
    const [account] = await db
      .insert(officialAccount)
      .values({
        providerId: input.providerId,
        name: input.name,
        oaId: input.oaId,
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
    const query = db
      .select({
        id: oaAccessToken.id,
        type: oaAccessToken.type,
        keyId: oaAccessToken.keyId,
        expiresAt: oaAccessToken.expiresAt,
        createdAt: oaAccessToken.createdAt,
      })
      .from(oaAccessToken)
      .where(eq(oaAccessToken.oaId, oaId))

    return query
  }

  async function revokeAccessToken(tokenId: string) {
    await db.delete(oaAccessToken).where(eq(oaAccessToken.id, tokenId))
  }

  async function revokeAllAccessTokens(oaId: string, keyId: string) {
    const result = await db
      .delete(oaAccessToken)
      .where(eq(oaAccessToken.keyId, keyId))
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

  return {
    createProvider,
    getProvider,
    updateProvider,
    deleteProvider,
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
  }
}

export type { OADeps }
