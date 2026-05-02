import { zql } from 'on-zero'

import { chatOaLoadingReadPermission } from '../models/chatOaLoading'

export const chatOaLoadingByChat = (props: { chatId: string; oaId: string }) => {
  return zql.chatOaLoading
    .where(chatOaLoadingReadPermission)
    .where('chatId', props.chatId)
    .where('oaId', props.oaId)
    .limit(1)
}
