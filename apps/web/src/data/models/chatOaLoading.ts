import { number, string, table } from '@rocicorp/zero'
import { serverWhere } from 'on-zero'

export const schema = table('chatOaLoading')
  .columns({
    id: string(),
    chatId: string(),
    oaId: string(),
    expiresAt: number(),
  })
  .primaryKey('id')

// Only users who are members of the chat can read loading state
export const chatOaLoadingReadPermission = serverWhere('chatOaLoading', (eb, auth) => {
  return eb.exists('members', (q) => q.where('userId', auth?.id || ''))
})
