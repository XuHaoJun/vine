import type { TableInsertRow, TableUpdateRow } from 'on-zero'
import type * as schema from './tables'

export type Chat = TableInsertRow<typeof schema.chat>
export type ChatUpdate = TableUpdateRow<typeof schema.chat>

export type ChatMember = TableInsertRow<typeof schema.chatMember>
export type ChatMemberUpdate = TableUpdateRow<typeof schema.chatMember>

export type Friendship = TableInsertRow<typeof schema.friendship>
export type FriendshipUpdate = TableUpdateRow<typeof schema.friendship>

export type Message = TableInsertRow<typeof schema.message>
export type MessageUpdate = TableUpdateRow<typeof schema.message>

export type Todo = TableInsertRow<typeof schema.todo>
export type TodoUpdate = TableUpdateRow<typeof schema.todo>

export type User = TableInsertRow<typeof schema.userPublic>
export type UserUpdate = TableUpdateRow<typeof schema.userPublic>

export type UserState = TableInsertRow<typeof schema.userState>
export type UserStateUpdate = TableUpdateRow<typeof schema.userState>
