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

// A user can read messages only if they are a member of that chat
// The 'members' relationship on message (via chatId → chatMember.chatId) is defined in Task 5
export const messageReadPermission = serverWhere('message', (eb, auth) => {
  return eb.exists('members', (q) => q.where('userId', auth?.id || ''))
})

const SYSTEM_PACKAGE_RE = /^\d+$/

export const mutate = mutations(schema, messageReadPermission, {
  send: async ({ authData, tx }, message: Message) => {
    if (!authData) throw new Error('Unauthorized')

    // Validate sender based on senderType
    if (message.senderType === 'user' && message.senderId !== authData.id) {
      throw new Error('Unauthorized')
    }
    if (message.senderType === 'oa' && !message.oaId) {
      throw new Error('OA message requires oaId')
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
  sendSticker: async ({ authData, tx }, message: Message) => {
    if (!authData) throw new Error('Unauthorized')
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
    if (message.senderType !== 'user') throw new Error('Unauthorized')
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
