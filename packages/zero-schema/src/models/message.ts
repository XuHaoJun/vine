import { number, string, table } from '@rocicorp/zero'
import { mutations, serverWhere } from 'on-zero'

import type { TableInsertRow } from 'on-zero'

export type Message = TableInsertRow<typeof schema>

export const schema = table('message')
  .columns({
    id: string(),
    chatId: string(),
    senderId: string(),
    type: string(),
    text: string().optional(),
    metadata: string().optional(),
    replyToMessageId: string().optional(),
    createdAt: number(),
  })
  .primaryKey('id')

// A user can read messages only if they are a member of that chat
// The 'members' relationship on message (via chatId → chatMember.chatId) is defined in Task 5
export const messageReadPermission = serverWhere('message', (eb, auth) => {
  return eb.exists('members', (q) => q.where('userId', auth?.id || ''))
})

export const mutate = mutations(schema, messageReadPermission, {
  // send: defined in Task 9
})
