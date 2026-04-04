import { index, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'

export const oaProvider = pgTable('oaProvider', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  ownerId: text('ownerId').notNull(),
  createdAt: timestamp('createdAt', { mode: 'string' }).defaultNow().notNull(),
  updatedAt: timestamp('updatedAt', { mode: 'string' }).defaultNow().notNull(),
})

export const officialAccount = pgTable('officialAccount', {
  id: uuid('id').primaryKey().defaultRandom(),
  providerId: uuid('providerId').notNull().references(() => oaProvider.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  oaId: text('oaId').notNull().unique(),
  description: text('description'),
  imageUrl: text('imageUrl'),
  channelSecret: text('channelSecret').notNull(),
  status: text('status').notNull().default('active'),
  createdAt: timestamp('createdAt', { mode: 'string' }).defaultNow().notNull(),
  updatedAt: timestamp('updatedAt', { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
  index('officialAccount_providerId_idx').on(table.providerId),
  index('officialAccount_oaId_idx').on(table.oaId),
])

export const oaWebhook = pgTable('oaWebhook', {
  id: uuid('id').primaryKey().defaultRandom(),
  oaId: uuid('oaId').notNull().references(() => officialAccount.id, { onDelete: 'cascade' }),
  url: text('url').notNull(),
  status: text('status').notNull().default('pending'),
  lastVerifiedAt: timestamp('lastVerifiedAt', { mode: 'string' }),
  createdAt: timestamp('createdAt', { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
  index('oaWebhook_oaId_idx').on(table.oaId),
])

export const oaFriendship = pgTable('oaFriendship', {
  id: uuid('id').primaryKey().defaultRandom(),
  oaId: uuid('oaId').notNull().references(() => officialAccount.id, { onDelete: 'cascade' }),
  userId: text('userId').notNull(),
  status: text('status').notNull().default('friend'),
  createdAt: timestamp('createdAt', { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
  index('oaFriendship_oaId_idx').on(table.oaId),
  index('oaFriendship_userId_idx').on(table.userId),
])

export const oaAccessToken = pgTable('oaAccessToken', {
  id: uuid('id').primaryKey().defaultRandom(),
  oaId: uuid('oaId').notNull().references(() => officialAccount.id, { onDelete: 'cascade' }),
  token: text('token').notNull(),
  type: text('type').notNull(),
  keyId: text('keyId'),
  expiresAt: timestamp('expiresAt', { mode: 'string' }),
  createdAt: timestamp('createdAt', { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
  index('oaAccessToken_oaId_idx').on(table.oaId),
  index('oaAccessToken_keyId_idx').on(table.keyId),
])
