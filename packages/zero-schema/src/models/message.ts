import { number, string, table } from '@rocicorp/zero'
import { mutations, serverWhere } from 'on-zero'

import type { TableInsertRow } from 'on-zero'

export type Message = TableInsertRow<typeof schema>

export const schema = table('message')
  .columns({
    id: string(),
    chatId: string(),
    senderId: string().optional(),
    senderType: string(),
    type: string(),
    text: string().optional(),
    metadata: string().optional(),
    replyToMessageId: string().optional(),
    createdAt: number(),
    oaId: string().optional(),
    miniAppId: string().optional(),
  })
  .primaryKey('id')

async function assertOaOwner(
  tx: { query?: Record<string, any> },
  oaId: string,
  userId: string,
) {
  const query = tx.query as Record<string, any> | undefined
  if (!query?.officialAccount || !query?.oaProvider) {
    throw new Error('Unauthorized')
  }

  const accounts = await query.officialAccount.where('id', oaId).run()
  const account = accounts[0]
  if (!account) throw new Error('Unauthorized')

  const providers = await query.oaProvider.where('id', account.providerId).run()
  const provider = providers[0]
  if (!provider || provider.ownerId !== userId) {
    throw new Error('Unauthorized')
  }
}

async function assertOaChat(
  tx: { query?: Record<string, any> },
  chatId: string,
  oaId: string,
) {
  const query = tx.query as Record<string, any> | undefined
  if (!query?.chat || !query?.chatMember) throw new Error('Unauthorized')

  const chats = await query.chat.where('id', chatId).where('type', 'oa').run()
  if (chats.length === 0) throw new Error('Unauthorized')

  const members = await query.chatMember.where('chatId', chatId).where('oaId', oaId).run()
  if (members.length === 0) throw new Error('Unauthorized')
}

function assertUserMessagePayload(message: Message) {
  if (message.senderType !== 'user') throw new Error('Unauthorized')
  if (message.oaId) throw new Error('User message cannot include oaId')
}

// A user can read messages if they are a member of the chat or manage the OA in it
export const messageReadPermission = serverWhere('message', (eb, auth) => {
  const userId = auth?.id || ''
  return eb.or(
    eb.exists('members', (q) => q.where('userId', userId)),
    eb.exists('members', (q) =>
      q
        .whereExists('chat', (chatQ) => chatQ.where('type', 'oa'))
        .whereExists('oa', (oaQ) =>
          oaQ.whereExists('provider', (providerQ) => providerQ.where('ownerId', userId)),
        ),
    ),
  )
})

const SYSTEM_PACKAGE_RE = /^\d+$/

const rejectDirectMessageMutation = async () => {
  throw new Error('Use a message action')
}

export const mutate = mutations(schema, messageReadPermission, {
  insert: rejectDirectMessageMutation,
  update: rejectDirectMessageMutation,
  upsert: rejectDirectMessageMutation,
  delete: rejectDirectMessageMutation,

  send: async ({ authData, tx }, message: Message) => {
    if (!authData) throw new Error('Unauthorized')

    if (message.senderType === 'oa') {
      throw new Error('Use sendAsOA for OA messages')
    }
    assertUserMessagePayload(message)

    // Validate sender based on senderType
    if (message.senderType === 'user' && message.senderId !== authData.id) {
      throw new Error('Unauthorized')
    }

    // Insert the message
    await tx.mutate.message.insert(message)

    // Update the chat's last message pointer for sorting the chat list
    await tx.mutate.chat.update({
      id: message.chatId,
      lastMessageId: message.id,
      lastMessageAt: message.createdAt,
    })
  },
  sendAsOA: async (
    { authData, tx },
    args: {
      id: string
      chatId: string
      oaId: string
      text: string
      createdAt: number
    },
  ) => {
    if (!authData) throw new Error('Unauthorized')

    const text = args.text.trim()
    if (!text) throw new Error('Message text is required')

    await assertOaOwner(tx as { query?: Record<string, any> }, args.oaId, authData.id)
    await assertOaChat(tx as { query?: Record<string, any> }, args.chatId, args.oaId)

    await tx.mutate.message.insert({
      id: args.id,
      chatId: args.chatId,
      senderType: 'oa',
      oaId: args.oaId,
      type: 'text',
      text,
      createdAt: args.createdAt,
    })

    await tx.mutate.chat.update({
      id: args.chatId,
      lastMessageId: args.id,
      lastMessageAt: args.createdAt,
    })
  },
  sendSticker: async ({ authData, tx }, message: Message) => {
    if (!authData) throw new Error('Unauthorized')
    assertUserMessagePayload(message)
    if (message.senderId !== authData.id) throw new Error('Unauthorized')

    const meta = JSON.parse(message.metadata ?? '{}') as {
      packageId?: string
      stickerId?: number
    }
    if (!meta.packageId || typeof meta.stickerId !== 'number') {
      throw new Error('Invalid sticker metadata')
    }

    // Verify entitlement: user must own the sticker package
    const query = tx.query as Record<string, any> | undefined
    if (!query?.entitlement) throw new Error('Unauthorized')
    const owned = await query.entitlement
      .where('userId', authData.id)
      .where('packageId', meta.packageId)
      .run()
    if (owned.length === 0) throw new Error('entitlement required')

    await tx.mutate.message.insert(message)
    await tx.mutate.chat.update({
      id: message.chatId,
      lastMessageId: message.id,
      lastMessageAt: message.createdAt,
    })
  },
  sendLiff: async ({ authData, tx }, message: Message) => {
    if (!authData) throw new Error('Unauthorized')
    assertUserMessagePayload(message)
    const liffMessage = { ...message, senderId: authData.id }

    const query = tx.query as Record<string, any> | undefined
    if (!query?.chatMember) throw new Error('Not a member')
    const members = await query.chatMember
      .where('userId', authData.id)
      .where('chatId', message.chatId)
      .where('status', 'accepted')
      .run()
    if (members.length === 0) throw new Error('Not a member')

    if (message.type === 'sticker') {
      const meta = JSON.parse(message.metadata ?? '{}') as {
        packageId?: string
        stickerId?: number
      }
      if (!meta.packageId || typeof meta.stickerId !== 'number') {
        throw new Error('Invalid sticker metadata')
      }
      if (!SYSTEM_PACKAGE_RE.test(meta.packageId)) {
        if (!query?.entitlement) throw new Error('Unauthorized')
        const owned = await query.entitlement
          .where('userId', authData.id)
          .where('packageId', meta.packageId)
          .run()
        if (owned.length === 0) throw new Error('entitlement required')
      }
    }

    await tx.mutate.message.insert(liffMessage)
    await tx.mutate.chat.update({
      id: liffMessage.chatId,
      lastMessageId: liffMessage.id,
      lastMessageAt: liffMessage.createdAt,
    })
  },
})
