import { serverWhere, zql } from 'on-zero'

import { messageReadPermission } from '../models/message'

export const managerOwnedOaMessagePermission = serverWhere('message', (eb, auth) => {
  const userId = auth?.id || ''
  return eb.exists('members', (q) =>
    q.whereExists('chat', (chatQ) => chatQ.where('type', 'oa')).whereExists('oa', (oaQ) =>
      oaQ.whereExists('provider', (providerQ) => providerQ.where('ownerId', userId)),
    ),
  )
})

// Most recent messages in a chat (Zero-synced, limit ~100)
export const messagesByChatId = (props: { chatId: string; limit?: number }) => {
  return zql.message
    .where(messageReadPermission)
    .where('chatId', props.chatId)
    .related('sender')
    .orderBy('createdAt', 'asc')
    .limit(props.limit ?? 100)
}

export const oaMessagesByChatId = (props: {
  oaId: string
  chatId: string
  limit?: number
}) => {
  return zql.message
    .where(managerOwnedOaMessagePermission)
    .where('chatId', props.chatId)
    .whereExists('members', (q) => q.where('oaId', props.oaId))
    .related('sender')
    .orderBy('createdAt', 'asc')
    .limit(props.limit ?? 100)
}
