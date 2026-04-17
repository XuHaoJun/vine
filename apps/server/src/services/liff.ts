import { eq } from 'drizzle-orm'
import type { NodePgDatabase } from 'drizzle-orm/node-postgres'
import type { schema } from '@vine/db'
import { loginChannel, oaLiffApp } from '@vine/db/schema-login'
import { randomBytes, randomUUID } from 'crypto'

type LiffDeps = {
  db: NodePgDatabase<typeof schema>
}

export function createLiffService(deps: LiffDeps) {
  const { db } = deps

  async function createLoginChannel(input: {
    providerId: string
    name: string
    description?: string | undefined
    oaId?: string | undefined
  }) {
    const channelId = randomUUID().replace(/-/g, '').slice(0, 10)
    const channelSecret = randomBytes(16).toString('hex')
    const [channel] = await db
      .insert(loginChannel)
      .values({
        providerId: input.providerId,
        oaId: input.oaId ?? null,
        name: input.name,
        channelId,
        channelSecret,
        description: input.description ?? null,
      })
      .returning()
    return channel
  }

  async function getLinkedOA(loginChannelId: string): Promise<string | null> {
    const [channel] = await db
      .select({ oaId: loginChannel.oaId })
      .from(loginChannel)
      .where(eq(loginChannel.id, loginChannelId))
      .limit(1)
    return channel?.oaId ?? null
  }

  async function getLoginChannel(id: string) {
    const [channel] = await db
      .select()
      .from(loginChannel)
      .where(eq(loginChannel.id, id))
      .limit(1)
    return channel ?? null
  }

  async function getLoginChannelSecret(id: string) {
    const [channel] = await db
      .select({
        channelSecret: loginChannel.channelSecret,
        channelId: loginChannel.channelId,
      })
      .from(loginChannel)
      .where(eq(loginChannel.id, id))
      .limit(1)
    return channel ?? null
  }

  async function listLoginChannels(providerId: string) {
    return db.select().from(loginChannel).where(eq(loginChannel.providerId, providerId))
  }

  async function deleteLoginChannel(id: string) {
    await db.delete(loginChannel).where(eq(loginChannel.id, id))
  }

  async function createLiffApp(input: {
    loginChannelId: string
    channelId: string
    viewType: string
    endpointUrl: string
    moduleMode?: boolean | undefined
    description?: string | undefined
    scopes?: string[] | undefined
    botPrompt?: string | undefined
    qrCode?: boolean | undefined
  }) {
    if (!input.endpointUrl.startsWith('https://')) {
      throw new Error('endpointUrl must use HTTPS')
    }

    const existing = await db
      .select()
      .from(oaLiffApp)
      .where(eq(oaLiffApp.loginChannelId, input.loginChannelId))
      .limit(30)
    if (existing.length >= 30) {
      throw new Error('maximum 30 LIFF apps per login channel')
    }

    const suffix = randomBytes(4).toString('hex')
    const liffId = `${input.channelId}-${suffix}`

    const [app] = await db
      .insert(oaLiffApp)
      .values({
        loginChannelId: input.loginChannelId,
        liffId,
        viewType: input.viewType,
        endpointUrl: input.endpointUrl,
        moduleMode: input.moduleMode ?? false,
        description: input.description ?? null,
        scopes: input.scopes ?? ['profile', 'chat_message.write'],
        botPrompt: input.botPrompt ?? 'none',
        qrCode: input.qrCode ?? false,
      })
      .returning()
    return app
  }

  async function updateLiffApp(
    liffId: string,
    input: {
      viewType?: string | undefined
      endpointUrl?: string | undefined
      moduleMode?: boolean | undefined
      description?: string | undefined
      scopes?: string[] | undefined
      botPrompt?: string | undefined
      qrCode?: boolean | undefined
    },
  ) {
    if (input.endpointUrl && !input.endpointUrl.startsWith('https://')) {
      throw new Error('endpointUrl must use HTTPS')
    }
    const [app] = await db
      .update(oaLiffApp)
      .set({
        ...(input.viewType !== undefined && { viewType: input.viewType }),
        ...(input.endpointUrl !== undefined && { endpointUrl: input.endpointUrl }),
        ...(input.moduleMode !== undefined && { moduleMode: input.moduleMode }),
        ...(input.description !== undefined && { description: input.description }),
        ...(input.scopes !== undefined && { scopes: input.scopes }),
        ...(input.botPrompt !== undefined && { botPrompt: input.botPrompt }),
        ...(input.qrCode !== undefined && { qrCode: input.qrCode }),
        updatedAt: new Date().toISOString(),
      })
      .where(eq(oaLiffApp.liffId, liffId))
      .returning()
    return app ?? null
  }

  async function getLiffApp(liffId: string) {
    const [app] = await db
      .select()
      .from(oaLiffApp)
      .where(eq(oaLiffApp.liffId, liffId))
      .limit(1)
    return app ?? null
  }

  async function listLiffApps(loginChannelId: string) {
    return db.select().from(oaLiffApp).where(eq(oaLiffApp.loginChannelId, loginChannelId))
  }

  async function deleteLiffApp(liffId: string) {
    await db.delete(oaLiffApp).where(eq(oaLiffApp.liffId, liffId))
  }

  return {
    createLoginChannel,
    getLoginChannel,
    getLoginChannelSecret,
    listLoginChannels,
    deleteLoginChannel,
    createLiffApp,
    updateLiffApp,
    getLiffApp,
    listLiffApps,
    deleteLiffApp,
    getLinkedOA,
  }
}

export type { LiffDeps }
