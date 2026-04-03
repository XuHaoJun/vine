import { number, string, table } from '@rocicorp/zero'
import { serverWhere } from 'on-zero'

export const schema = table('chat')
  .columns({
    id: string(),
    type: string(),
    lastMessageId: string().optional(),
    lastMessageAt: number().optional(),
    createdAt: number(),
  })
  .primaryKey('id')

// A user can read a chat only if they are a member
// The 'members' relationship is defined in relationships.ts (Task 5)
export const chatReadPermission = serverWhere('chat', (eb, auth) => {
  return eb.exists('members', (q) => q.where('userId', auth?.id || ''))
})

// No client-side CRUD mutations for chat — only custom mutators in
// friendship.ts (acceptFriendship) and message.ts (sendMessage) can write to chat
// via tx.mutate.chat.* inside their server-side custom mutator context
