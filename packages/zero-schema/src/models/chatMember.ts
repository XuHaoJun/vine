import { number, string, table } from '@rocicorp/zero'
import { mutations, serverWhere } from 'on-zero'

import type { TableInsertRow } from 'on-zero'

export type ChatMember = TableInsertRow<typeof schema>

export const schema = table('chatMember')
  .columns({
    id: string(),
    chatId: string(),
    userId: string().optional(),
    role: string().optional(),
    lastReadMessageId: string().optional(),
    lastReadAt: number().optional(),
    joinedAt: number(),
    oaId: string().optional(),
  })
  .primaryKey('id')

// A user can read chatMember records if:
// - it's their own record (userId match), OR
// - the record belongs to a chat they are also a member of (needed for read markers)
const chatMemberPermission = serverWhere('chatMember', (eb, auth) => {
  return eb.or(
    eb.cmp('userId', auth?.id || ''),
    eb.exists('chat', (q) =>
      q.whereExists('members', (mq) => mq.where('userId', auth?.id || '')),
    ),
  )
})

export const mutate = mutations(schema, chatMemberPermission, {
  markRead: async (
    { authData, can, tx },
    data: { id: string; lastReadMessageId: string; lastReadAt: number },
  ) => {
    if (!authData) throw new Error('Unauthorized')

    await can(chatMemberPermission, data.id)

    await tx.mutate.chatMember.update({
      id: data.id,
      lastReadMessageId: data.lastReadMessageId,
      lastReadAt: data.lastReadAt,
    })
  },

  addMembers: async (
    { authData, tx },
    args: {
      chatId: string
      userIds: string[]
      createdAt: number
    },
  ) => {
    if (!authData) throw new Error('Unauthorized')

    const callerMembers = await tx.query.chatMember
      .where('chatId', args.chatId)
      .where('userId', authData.id)
      .run()

    if (callerMembers.length === 0) throw new Error('Not a member of this group')

    const caller = callerMembers[0]
    if (caller.role !== 'owner' && caller.role !== 'admin') {
      throw new Error('Only owner or admin can add members')
    }

    for (const userId of args.userIds) {
      if (userId === authData.id) continue

      const existing = await tx.query.chatMember
        .where('chatId', args.chatId)
        .where('userId', userId)
        .run()

      if (existing.length > 0) continue

      await tx.mutate.chatMember.insert({
        id: `${args.chatId}_${userId}`,
        chatId: args.chatId,
        userId,
        role: 'member',
        joinedAt: args.createdAt,
      })
    }
  },

  removeMember: async (
    { authData, tx },
    args: {
      chatId: string
      targetUserId: string
    },
  ) => {
    if (!authData) throw new Error('Unauthorized')

    const callerMembers = await tx.query.chatMember
      .where('chatId', args.chatId)
      .where('userId', authData.id)
      .run()

    if (callerMembers.length === 0) throw new Error('Not a member of this group')

    const caller = callerMembers[0]
    if (caller.role !== 'owner' && caller.role !== 'admin') {
      throw new Error('Only owner or admin can remove members')
    }

    const targetMembers = await tx.query.chatMember
      .where('chatId', args.chatId)
      .where('userId', args.targetUserId)
      .run()

    if (targetMembers.length === 0) throw new Error('Target is not a member')

    const target = targetMembers[0]
    if (target.role === 'owner') {
      throw new Error('Cannot remove the owner')
    }

    await tx.mutate.chatMember.delete({ id: target.id })
  },

  leaveGroup: async (
    { authData, tx },
    args: {
      chatId: string
    },
  ) => {
    if (!authData) throw new Error('Unauthorized')

    const myMembers = await tx.query.chatMember
      .where('chatId', args.chatId)
      .where('userId', authData.id)
      .run()

    if (myMembers.length === 0) throw new Error('Not a member of this group')

    const me = myMembers[0]
    if (me.role === 'owner') {
      throw new Error('Owner must transfer ownership before leaving')
    }

    await tx.mutate.chatMember.delete({ id: me.id })
  },

  transferOwnership: async (
    { authData, tx },
    args: {
      chatId: string
      newOwnerId: string
    },
  ) => {
    if (!authData) throw new Error('Unauthorized')

    const myMembers = await tx.query.chatMember
      .where('chatId', args.chatId)
      .where('userId', authData.id)
      .run()

    if (myMembers.length === 0) throw new Error('Not a member of this group')

    const me = myMembers[0]
    if (me.role !== 'owner') {
      throw new Error('Only owner can transfer ownership')
    }

    const newOwnerMembers = await tx.query.chatMember
      .where('chatId', args.chatId)
      .where('userId', args.newOwnerId)
      .run()

    if (newOwnerMembers.length === 0) throw new Error('New owner is not a member')

    await tx.mutate.chatMember.update({
      id: me.id,
      role: 'member',
    })

    await tx.mutate.chatMember.update({
      id: newOwnerMembers[0].id,
      role: 'owner',
    })
  },

  joinViaInvite: async (
    { authData, tx },
    args: {
      inviteCode: string
      createdAt: number
    },
  ) => {
    if (!authData) throw new Error('Unauthorized')

    const chats = await tx.query.chat
      .where('inviteCode', args.inviteCode)
      .run()

    if (chats.length === 0) throw new Error('Invalid invite code')

    const chat = chats[0]

    const existing = await tx.query.chatMember
      .where('chatId', chat.id)
      .where('userId', authData.id)
      .run()

    if (existing.length > 0) throw new Error('Already a member of this group')

    await tx.mutate.chatMember.insert({
      id: `${chat.id}_${authData.id}`,
      chatId: chat.id,
      userId: authData.id,
      role: 'member',
      joinedAt: args.createdAt,
    })
  },
})
