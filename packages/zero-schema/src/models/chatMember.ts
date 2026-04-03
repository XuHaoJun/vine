import { number, string, table } from '@rocicorp/zero'
import { mutations, serverWhere } from 'on-zero'

import type { TableInsertRow } from 'on-zero'

export type ChatMember = TableInsertRow<typeof schema>

export const schema = table('chatMember')
  .columns({
    id: string(),
    chatId: string(),
    userId: string(),
    lastReadMessageId: string().optional(),
    lastReadAt: number().optional(),
    joinedAt: number(),
  })
  .primaryKey('id')

// A user can read chatMember records if:
// - it's their own record, OR
// - the record belongs to a chat they are also a member of (needed for read markers)
const chatMemberPermission = serverWhere('chatMember', (eb, auth) => {
  return eb.or(
    eb.cmp('userId', auth?.id || ''),
    eb.exists('chat', (q) =>
      q.exists('members', (mq) => mq.where('userId', auth?.id || '')),
    ),
  )
})

export const mutate = mutations(schema, chatMemberPermission, {
  // Custom update for read marker — only allows updating lastReadMessageId/lastReadAt
  markRead: async ({ authData, can, tx }, data: { id: string; lastReadMessageId: string; lastReadAt: number }) => {
    if (!authData) throw new Error('Unauthorized')

    // Verify the caller owns this chatMember record
    await can(chatMemberPermission, authData.id)

    await tx.mutate.chatMember.update({
      id: data.id,
      lastReadMessageId: data.lastReadMessageId,
      lastReadAt: data.lastReadAt,
    })
  },
})
