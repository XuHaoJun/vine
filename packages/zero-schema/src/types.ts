import type { ChatMember, Friendship, Message } from './generated/types'
import type { Todo, User, UserState } from './generated/types'

export type * from './generated/types'

export type AuthData = {
  id: string
  role: 'admin' | undefined
  email?: string
}

export type UserWithState = User & {
  state?: UserState
}

export type UserWithRelations = User & {
  state?: UserState
  todos?: readonly Todo[]
}

export type TodoWithUser = Todo & {
  user?: User
}

export type FriendshipWithUsers = Friendship & {
  requester?: User
  addressee?: User
}

export type ChatWithMembers = {
  id: string
  type: string
  lastMessageId: string | null
  lastMessageAt: number | null
  createdAt: number
  members?: readonly (ChatMember & { user?: User })[]
  lastMessage?: Message | null
}

export type MessageWithSender = Message & {
  sender?: User
}
