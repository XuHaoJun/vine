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
  })
  .primaryKey('id')

// A user can read messages only if they are a member of that chat
// The 'members' relationship on message (via chatId → chatMember.chatId) is defined in Task 5
export const messageReadPermission = serverWhere('message', (eb, auth) => {
  return eb.exists('members', (q) => q.where('userId', auth?.id || ''))
})

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
})
