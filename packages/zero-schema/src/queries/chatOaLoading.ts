import { zql } from 'on-zero'

import { permissions } from '../models/chatOaLoading'

export const chatOaLoadingByChat = (props: { chatId: string; oaId: string }) => {
  return zql.chatOaLoading
    .where(permissions)
    .where('chatId', props.chatId)
    .where('oaId', props.oaId)
    .limit(1)
}
