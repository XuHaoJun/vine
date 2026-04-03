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
  return zql.chatMember.where('chatId', props.chatId).related('user')
}
