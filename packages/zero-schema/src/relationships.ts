import { relationships } from '@rocicorp/zero'

import * as tables from './generated/tables'

export const userRelationships = relationships(tables.userPublic, ({ many, one }) => ({
  state: one({
    sourceField: ['id'],
    destSchema: tables.userState,
    destField: ['userId'],
  }),
  todos: many({
    sourceField: ['id'],
    destSchema: tables.todo,
    destField: ['userId'],
  }),
}))

export const todoRelationships = relationships(tables.todo, ({ one }) => ({
  user: one({
    sourceField: ['userId'],
    destSchema: tables.userPublic,
    destField: ['id'],
  }),
}))

export const userStateRelationships = relationships(tables.userState, ({ one }) => ({
  user: one({
    sourceField: ['userId'],
    destSchema: tables.userPublic,
    destField: ['id'],
  }),
}))

export const friendshipRelationships = relationships(tables.friendship, ({ one }) => ({
  requester: one({
    sourceField: ['requesterId'],
    destSchema: tables.userPublic,
    destField: ['id'],
  }),
  addressee: one({
    sourceField: ['addresseeId'],
    destSchema: tables.userPublic,
    destField: ['id'],
  }),
}))

export const chatRelationships = relationships(tables.chat, ({ many, one }) => ({
  // Used by chatReadPermission (eb.exists('members', ...))
  members: many({
    sourceField: ['id'],
    destSchema: tables.chatMember,
    destField: ['chatId'],
  }),
  lastMessage: one({
    sourceField: ['lastMessageId'],
    destSchema: tables.message,
    destField: ['id'],
  }),
}))

export const chatMemberRelationships = relationships(tables.chatMember, ({ one }) => ({
  user: one({
    sourceField: ['userId'],
    destSchema: tables.userPublic,
    destField: ['id'],
  }),
  chat: one({
    sourceField: ['chatId'],
    destSchema: tables.chat,
    destField: ['id'],
  }),
}))

export const chatOaLoadingRelationships = relationships(
  tables.chatOaLoading,
  ({ many }) => ({
    // Used by chatOaLoadingReadPermission (eb.exists('members', ...))
    members: many({
      sourceField: ['chatId'],
      destSchema: tables.chatMember,
      destField: ['chatId'],
    }),
  }),
)

export const messageRelationships = relationships(tables.message, ({ many, one }) => ({
  sender: one({
    sourceField: ['senderId'],
    destSchema: tables.userPublic,
    destField: ['id'],
  }),
  // Used by messageReadPermission (eb.exists('members', ...))
  // Matches chatMember rows where chatMember.chatId = message.chatId
  members: many({
    sourceField: ['chatId'],
    destSchema: tables.chatMember,
    destField: ['chatId'],
  }),
}))

export const entitlementRelationships = relationships(tables.entitlement, ({ one }) => ({
  stickerPackage: one({
    sourceField: ['packageId'],
    destSchema: tables.stickerPackage,
    destField: ['id'],
  }),
}))

export const creatorProfileRelationships = relationships(
  tables.creatorProfile,
  ({ many }) => ({
    packages: many({
      sourceField: ['id'],
      destSchema: tables.stickerPackage,
      destField: ['creatorId'],
    }),
  }),
)

export const stickerPackageRelationships = relationships(
  tables.stickerPackage,
  ({ one, many }) => ({
    creator: one({
      sourceField: ['creatorId'],
      destSchema: tables.creatorProfile,
      destField: ['id'],
    }),
    assets: many({
      sourceField: ['id'],
      destSchema: tables.stickerAsset,
      destField: ['packageId'],
    }),
  }),
)

export const stickerAssetRelationships = relationships(
  tables.stickerAsset,
  ({ one }) => ({
    package: one({
      sourceField: ['packageId'],
      destSchema: tables.stickerPackage,
      destField: ['id'],
    }),
  }),
)

export const allRelationships = [
  userRelationships,
  todoRelationships,
  userStateRelationships,
  friendshipRelationships,
  chatRelationships,
  chatMemberRelationships,
  chatOaLoadingRelationships,
  messageRelationships,
  entitlementRelationships,
  creatorProfileRelationships,
  stickerPackageRelationships,
  stickerAssetRelationships,
]
