import { serverWhere, zql } from 'on-zero'

const permission = serverWhere('chat', (_, auth) => {
  return _.exists('members', (m) => m.where('userId', auth?.id || ''))
})

export const chatById = (props: { chatId: string }) => {
  return zql.chat.where(permission).where('id', props.chatId).one()
}

export const chatsByUserId = (props: { userId: string }) => {
  return zql.chat
    .where(permission)
    .whereExists('members', (m) => m.where('userId', props.userId))
    .orderBy('lastMessageAt', 'desc')
}
