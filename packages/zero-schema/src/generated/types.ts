import type * as schema from './tables'
import type { TableInsertRow, TableUpdateRow } from 'on-zero'

export type Chat = TableInsertRow<typeof schema.chat>
export type ChatUpdate = TableUpdateRow<typeof schema.chat>

export type ChatMember = TableInsertRow<typeof schema.chatMember>
export type ChatMemberUpdate = TableUpdateRow<typeof schema.chatMember>

export type ChatOaLoading = TableInsertRow<typeof schema.chatOaLoading>
export type ChatOaLoadingUpdate = TableUpdateRow<typeof schema.chatOaLoading>

export type CreatorProfile = TableInsertRow<typeof schema.creatorProfile>
export type CreatorProfileUpdate = TableUpdateRow<typeof schema.creatorProfile>

export type Entitlement = TableInsertRow<typeof schema.entitlement>
export type EntitlementUpdate = TableUpdateRow<typeof schema.entitlement>

export type Friendship = TableInsertRow<typeof schema.friendship>
export type FriendshipUpdate = TableUpdateRow<typeof schema.friendship>

export type Message = TableInsertRow<typeof schema.message>
export type MessageUpdate = TableUpdateRow<typeof schema.message>

export type OaContactProfile = TableInsertRow<typeof schema.oaContactProfile>
export type OaContactProfileUpdate = TableUpdateRow<typeof schema.oaContactProfile>

export type OaContactTag = TableInsertRow<typeof schema.oaContactTag>
export type OaContactTagUpdate = TableUpdateRow<typeof schema.oaContactTag>

export type OaContactTagAssignment = TableInsertRow<typeof schema.oaContactTagAssignment>
export type OaContactTagAssignmentUpdate = TableUpdateRow<
  typeof schema.oaContactTagAssignment
>

export type OaFriendship = TableInsertRow<typeof schema.oaFriendship>
export type OaFriendshipUpdate = TableUpdateRow<typeof schema.oaFriendship>

export type OaProvider = TableInsertRow<typeof schema.oaProvider>
export type OaProviderUpdate = TableUpdateRow<typeof schema.oaProvider>

export type OfficialAccount = TableInsertRow<typeof schema.officialAccount>
export type OfficialAccountUpdate = TableUpdateRow<typeof schema.officialAccount>

export type StickerAsset = TableInsertRow<typeof schema.stickerAsset>
export type StickerAssetUpdate = TableUpdateRow<typeof schema.stickerAsset>

export type StickerPackage = TableInsertRow<typeof schema.stickerPackage>
export type StickerPackageUpdate = TableUpdateRow<typeof schema.stickerPackage>

export type Todo = TableInsertRow<typeof schema.todo>
export type TodoUpdate = TableUpdateRow<typeof schema.todo>

export type User = TableInsertRow<typeof schema.userPublic>
export type UserUpdate = TableUpdateRow<typeof schema.userPublic>

export type UserState = TableInsertRow<typeof schema.userState>
export type UserStateUpdate = TableUpdateRow<typeof schema.userState>
