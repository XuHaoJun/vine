import { number, string, table } from '@rocicorp/zero'
/* eslint-disable @typescript-eslint/no-deprecated -- tx.query is the current Zero mutations API */
import { mutations, run, serverWhere, zql } from 'on-zero'
import type { TableInsertRow } from 'on-zero'

export type Message = TableInsertRow<typeof schema>

type OARichMessageInput = {
  id: string
  type: Message['type']
  text?: string | null
  metadata?: string | null
}

async function readRows(
  tx: { query?: Record<string, any> },
  tableName: string,
  build: (query: any) => any,
) {
  const query = tx.query as Record<string, any> | undefined
  const txQuery = query?.[tableName]
  if (txQuery) {
    return build(txQuery).run()
  }

  return run(build((zql as Record<string, any>)[tableName]))
}

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
  const accounts = await readRows(tx, 'officialAccount', (q) => q.where('id', oaId))
  const account = accounts[0]
  if (!account) throw new Error('Unauthorized')

  const providers = await readRows(tx, 'oaProvider', (q) =>
    q.where('id', account.providerId),
  )
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
  const chats = await readRows(tx, 'chat', (q) =>
    q.where('id', chatId).where('type', 'oa'),
  )
  if (chats.length === 0) throw new Error('Unauthorized')

  const members = await readRows(tx, 'chatMember', (q) =>
    q.where('chatId', chatId).where('oaId', oaId),
  )
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
  sendRichAsOA: async (
    { authData, tx },
    args: {
      chatId: string
      oaId: string
      createdAt: number
      messages: OARichMessageInput[]
    },
  ) => {
    if (!authData) throw new Error('Unauthorized')
    if (args.messages.length === 0) throw new Error('At least one message is required')

    await assertOaOwner(tx as { query?: Record<string, any> }, args.oaId, authData.id)
    await assertOaChat(tx as { query?: Record<string, any> }, args.chatId, args.oaId)

    let index = 0
    for (const item of args.messages) {
      if (!item.id) throw new Error('Message id is required')
      if (item.type === 'template') throw new Error('Template messages are not supported')
      if (item.type === 'text' && !item.text?.trim()) {
        throw new Error('Message text is required')
      }
      await tx.mutate.message.insert({
        id: item.id,
        chatId: args.chatId,
        senderType: 'oa',
        oaId: args.oaId,
        type: item.type,
        text: item.type === 'text' ? item.text!.trim() : (item.text ?? null),
        metadata: item.metadata ?? null,
        createdAt: args.createdAt + index,
      })
      index++
    }

    const last = args.messages[args.messages.length - 1]!
    const lastCreatedAt = args.createdAt + args.messages.length - 1
    await tx.mutate.chat.update({
      id: args.chatId,
      lastMessageId: last.id,
      lastMessageAt: lastCreatedAt,
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
