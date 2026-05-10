import type {
  ChatMember,
  Friendship,
  Message,
  OaContactProfile,
  OaContactTag,
  OaContactTagAssignment,
} from './generated/types'
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

export type OaContactTagAssignmentWithTag = OaContactTagAssignment & {
  tag?: OaContactTag
}

export type OaFriendshipWithCrm = {
  id: string
  oaId: string
  userId: string
  status: string
  createdAt: number
  user?: User
  profile?: OaContactProfile | null
  tagAssignments?: readonly OaContactTagAssignmentWithTag[]
}
