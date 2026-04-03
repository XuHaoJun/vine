import { serverWhere, zql } from 'on-zero'

const permission = serverWhere('message', (_, auth) => {
  return _.exists('members', (m) => m.where('userId', auth?.id || ''))
})

export const messagesByChatId = (props: { chatId: string; limit?: number }) => {
  return zql.message
    .where(permission)
    .where('chatId', props.chatId)
    .orderBy('createdAt', 'desc')
    .limit(props.limit ?? 50)
}

export const messageById = (props: { messageId: string }) => {
  return zql.message.where(permission).where('id', props.messageId).one()
}
