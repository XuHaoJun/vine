import { number, string, table } from '@rocicorp/zero'
import { mutations, serverWhere } from 'on-zero'

import type { TableInsertRow } from 'on-zero'

export type Chat = TableInsertRow<typeof schema>

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

export const mutate = mutations(schema, chatReadPermission, {
  insertOAChat: async (
    { authData, tx },
    args: {
      chatId: string
      userId: string
      oaId: string
      member1Id: string
      member2Id: string
      createdAt: number
    },
  ) => {
    if (!authData) throw new Error('Unauthorized')

    // Check for existing OA chat between this user and OA (dedup)
    const query = tx.query as Record<string, any> | undefined
    if (query?.chatMember) {
      const userMemberships = await query.chatMember.where('userId', args.userId).run()

      for (const userMember of userMemberships) {
        const oasInChat = await query.chatMember
          .where('chatId', userMember.chatId)
          .where('oaId', args.oaId)
          .run()
        if (oasInChat.length > 0) {
          // Chat already exists between this user and OA — skip creation
          return
        }
      }
    }

    await tx.mutate.chat.insert({
      id: args.chatId,
      type: 'oa',
      createdAt: args.createdAt,
    })

    await tx.mutate.chatMember.insert({
      id: args.member1Id,
      chatId: args.chatId,
      userId: args.userId,
      joinedAt: args.createdAt,
    })

    await tx.mutate.chatMember.insert({
      id: args.member2Id,
      chatId: args.chatId,
      oaId: args.oaId,
      joinedAt: args.createdAt,
    })
  },
})
