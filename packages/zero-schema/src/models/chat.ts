import { number, string, table } from '@rocicorp/zero'
import { mutations, serverWhere } from 'on-zero'

import type { TableInsertRow } from 'on-zero'

export type Chat = TableInsertRow<typeof schema>

export const schema = table('chat')
  .columns({
    id: string(),
    type: string(),
    name: string().optional(),
    image: string().optional(),
    description: string().optional(),
    inviteCode: string().optional(),
    albumCount: number().optional(),
    noteCount: number().optional(),
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
  findOrCreateDirectChat: async (
    { authData, tx },
    args: {
      friendUserId: string
      chatId: string
      member1Id: string
      member2Id: string
    },
  ) => {
    if (!authData) throw new Error('Unauthorized')

    const userId = authData.id
    const query = tx.query as Record<string, any> | undefined

    const now = Date.now()
    let foundChatId: string | undefined

    if (query?.chatMember) {
      const userMemberships = await query.chatMember.where('userId', userId).run()

      for (const userMember of userMemberships) {
        const friendMemberships = await query.chatMember
          .where('chatId', userMember.chatId)
          .where('userId', args.friendUserId)
          .run()
        if (friendMemberships.length > 0) {
          const chatRows = await query.chat
            .where('id', userMember.chatId)
            .where('type', 'direct')
            .run()
          if (chatRows.length > 0) {
            foundChatId = userMember.chatId
            break
          }
        }
      }
    }

    if (!foundChatId) {
      await tx.mutate.chat.insert({
        id: args.chatId,
        type: 'direct',
        createdAt: now,
      })

      await tx.mutate.chatMember.insert({
        id: args.member1Id,
        chatId: args.chatId,
        userId,
        joinedAt: now,
      })

      await tx.mutate.chatMember.insert({
        id: args.member2Id,
        chatId: args.chatId,
        userId: args.friendUserId,
        joinedAt: now,
      })
    }
  },
  createGroupChat: async (
    { authData, tx },
    args: {
      chatId: string
      name: string
      image?: string
      memberIds: string[]
      createdAt: number
    },
  ) => {
    if (!authData) throw new Error('Unauthorized')
    if (args.memberIds.length < 1) throw new Error('Group needs at least 2 members')
    if (!args.memberIds.includes(authData.id)) {
      args.memberIds.unshift(authData.id)
    }

    await tx.mutate.chat.insert({
      id: args.chatId,
      type: 'group',
      name: args.name,
      image: args.image,
      createdAt: args.createdAt,
    })

    for (let i = 0; i < args.memberIds.length; i++) {
      await tx.mutate.chatMember.insert({
        id: `${args.chatId}_${args.memberIds[i]}`,
        chatId: args.chatId,
        userId: args.memberIds[i],
        joinedAt: args.createdAt,
      })
    }
  },
  updateGroupInfo: async (
    { authData, tx },
    args: {
      chatId: string
      name?: string
      image?: string
      description?: string
    },
  ) => {
    if (!authData) throw new Error('Unauthorized')

    const query = tx.query as Record<string, any> | undefined
    if (!query?.chatMember) throw new Error('Not a member of this group')

    const members = await query.chatMember
      .where('chatId', args.chatId)
      .where('userId', authData.id)
      .run()

    if (members.length === 0) throw new Error('Not a member of this group')

    const updateData: {
      id: string
      name?: string
      image?: string
      description?: string
    } = { id: args.chatId }
    if (args.name !== undefined) updateData.name = args.name
    if (args.image !== undefined) updateData.image = args.image
    if (args.description !== undefined) updateData.description = args.description

    await tx.mutate.chat.update(updateData)
  },
  generateInviteLink: async ({ authData, tx }, args: { chatId: string }) => {
    if (!authData) throw new Error('Unauthorized')

    const query = tx.query as Record<string, any> | undefined
    if (!query?.chatMember) throw new Error('Not a member of this group')

    const members = await query.chatMember
      .where('chatId', args.chatId)
      .where('userId', authData.id)
      .run()

    if (members.length === 0) throw new Error('Not a member of this group')

    const inviteCode = crypto.randomUUID().replace(/-/g, '').slice(0, 16)

    await tx.mutate.chat.update({
      id: args.chatId,
      inviteCode,
    })
  },
  revokeInviteLink: async ({ authData, tx }, args: { chatId: string }) => {
    if (!authData) throw new Error('Unauthorized')

    const query = tx.query as Record<string, any> | undefined
    if (!query?.chatMember) throw new Error('Not a member of this group')

    const members = await query.chatMember
      .where('chatId', args.chatId)
      .where('userId', authData.id)
      .run()

    if (members.length === 0) throw new Error('Not a member of this group')

    await tx.mutate.chat.update({
      id: args.chatId,
      inviteCode: null,
    })
  },
})
