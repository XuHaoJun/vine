import { zql } from 'on-zero'

import { messageReadPermission } from '../models/message'

// Most recent messages in a chat (Zero-synced, limit ~100)
export const messagesByChatId = (props: { chatId: string; limit?: number }) => {
  return zql.message
    .where(messageReadPermission)
    .where('chatId', props.chatId)
    .related('sender')
    .orderBy('createdAt', 'asc')
    .limit(props.limit ?? 100)
}
