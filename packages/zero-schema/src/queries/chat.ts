import { zql } from 'on-zero'

import { chatReadPermission } from '../models/chat'

// All chats where the current user is a member, ordered by latest message
export const chatsByUserId = (props: { userId: string }) => {
  return zql.chat
    .where(chatReadPermission)
    .related('members', (q) => q.related('user'))
    .related('lastMessage')
    .orderBy('lastMessageAt', 'desc')
    .limit(50)
}

// Members of a specific chat (for chatroom: find the other user)
export const chatMembersByChatId = (props: { chatId: string }) => {
  return zql.chatMember
    .where('chatId', props.chatId)
    .where('status', 'accepted')
    .related('user')
}

export const oaChatsByOfficialAccountId = (props: { oaId: string }) => {
  return zql.chat
    .where(chatReadPermission)
    .where('type', 'oa')
    .whereExists('members', (q) => q.where('oaId', props.oaId))
    .related('members', (q) => q.related('user').related('oa'))
    .related('lastMessage')
    .orderBy('lastMessageAt', 'desc')
    .limit(50)
}

export const oaChatMembersByChatId = (props: { oaId: string; chatId: string }) => {
  return zql.chatMember
    .where('chatId', props.chatId)
    .whereExists('chat', (q) =>
      q
        .where(chatReadPermission)
        .where('id', props.chatId)
        .whereExists('members', (mq) => mq.where('oaId', props.oaId)),
    )
    .related('user')
    .related('oa')
}

export const chatById = (props: { chatId: string }) => {
  return zql.chat.where(chatReadPermission).where('id', props.chatId).limit(1)
}

export const groupInfo = (props: { chatId: string }) => {
  return zql.chat
    .where(chatReadPermission)
    .where('id', props.chatId)
    .where('type', 'group')
    .related('members')
    .limit(1)
}

export const groupMembersWithRoles = (props: { chatId: string }) => {
  return zql.chatMember
    .where('chatId', props.chatId)
    .where('status', 'accepted')
    .related('user')
    .orderBy('joinedAt', 'asc')
}

export const pendingMembersByChatId = (props: { chatId: string }) => {
  return zql.chatMember
    .where('chatId', props.chatId)
    .where('status', 'pending')
    .related('user')
}

export const pendingInvitesByUserId = (props: { userId: string }) => {
  return zql.chatMember
    .where('userId', props.userId)
    .where('status', 'pending')
    .related('chat')
}
