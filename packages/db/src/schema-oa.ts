import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core'

export const oaProvider = pgTable('oaProvider', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  ownerId: text('ownerId').notNull(),
  createdAt: timestamp('createdAt', { mode: 'string' }).defaultNow().notNull(),
  updatedAt: timestamp('updatedAt', { mode: 'string' }).defaultNow().notNull(),
})

export const officialAccount = pgTable(
  'officialAccount',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    providerId: uuid('providerId')
      .notNull()
      .references(() => oaProvider.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    uniqueId: text('uniqueId').notNull().unique(),
    description: text('description'),
    imageUrl: text('imageUrl'),
    channelSecret: text('channelSecret').notNull(),
    status: text('status').notNull().default('active'),
    kind: text('kind').notNull().default('user').$type<'user' | 'platform_system'>(),
    email: text('email'),
    country: text('country'),
    company: text('company'),
    industry: text('industry'),
    createdAt: timestamp('createdAt', { mode: 'string' }).defaultNow().notNull(),
    updatedAt: timestamp('updatedAt', { mode: 'string' }).defaultNow().notNull(),
  },
  (table) => [
    index('officialAccount_providerId_idx').on(table.providerId),
    index('officialAccount_uniqueId_idx').on(table.uniqueId),
  ],
)

export const oaWebhook = pgTable(
  'oaWebhook',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    oaId: uuid('oaId')
      .notNull()
      .references(() => officialAccount.id, { onDelete: 'cascade' }),
    url: text('url').notNull(),
    status: text('status').notNull().default('pending'),
    useWebhook: boolean('useWebhook').notNull().default(true),
    webhookRedeliveryEnabled: boolean('webhookRedeliveryEnabled')
      .notNull()
      .default(false),
    errorStatisticsEnabled: boolean('errorStatisticsEnabled').notNull().default(false),
    lastVerifyStatusCode: integer('lastVerifyStatusCode'),
    lastVerifyReason: text('lastVerifyReason'),
    lastVerifiedAt: timestamp('lastVerifiedAt', { mode: 'string' }),
    createdAt: timestamp('createdAt', { mode: 'string' }).defaultNow().notNull(),
  },
  (table) => [uniqueIndex('oaWebhook_oaId_unique_idx').on(table.oaId)],
)

export const oaFriendship = pgTable(
  'oaFriendship',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    oaId: uuid('oaId')
      .notNull()
      .references(() => officialAccount.id, { onDelete: 'cascade' }),
    userId: text('userId').notNull(),
    status: text('status').notNull().default('friend'),
    createdAt: timestamp('createdAt', { mode: 'string' }).defaultNow().notNull(),
  },
  (table) => [
    index('oaFriendship_oaId_idx').on(table.oaId),
    index('oaFriendship_userId_idx').on(table.userId),
  ],
)

export const oaAccessToken = pgTable(
  'oaAccessToken',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    oaId: uuid('oaId')
      .notNull()
      .references(() => officialAccount.id, { onDelete: 'cascade' }),
    token: text('token').notNull(),
    type: text('type').notNull(),
    keyId: text('keyId'),
    expiresAt: timestamp('expiresAt', { mode: 'string' }),
    createdAt: timestamp('createdAt', { mode: 'string' }).defaultNow().notNull(),
  },
  (table) => [
    index('oaAccessToken_oaId_idx').on(table.oaId),
    index('oaAccessToken_keyId_idx').on(table.keyId),
  ],
)

export const oaRichMenu = pgTable(
  'oaRichMenu',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    oaId: uuid('oaId')
      .notNull()
      .references(() => officialAccount.id, { onDelete: 'cascade' }),
    richMenuId: text('richMenuId').notNull(),
    name: text('name').notNull(),
    chatBarText: text('chatBarText').notNull(),
    selected: boolean('selected').notNull().default(false),
    sizeWidth: integer('sizeWidth').notNull(),
    sizeHeight: integer('sizeHeight').notNull(),
    areas: jsonb('areas').notNull().default([]),
    hasImage: boolean('hasImage').notNull().default(false),
    createdAt: timestamp('createdAt', { mode: 'string' }).defaultNow().notNull(),
    updatedAt: timestamp('updatedAt', { mode: 'string' }).defaultNow().notNull(),
  },
  (table) => [
    index('oaRichMenu_oaId_idx').on(table.oaId),
    index('oaRichMenu_richMenuId_idx').on(table.richMenuId),
  ],
)

export const oaRichMenuAlias = pgTable(
  'oaRichMenuAlias',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    oaId: uuid('oaId')
      .notNull()
      .references(() => officialAccount.id, { onDelete: 'cascade' }),
    richMenuAliasId: text('richMenuAliasId').notNull(),
    richMenuId: text('richMenuId').notNull(),
    createdAt: timestamp('createdAt', { mode: 'string' }).defaultNow().notNull(),
    updatedAt: timestamp('updatedAt', { mode: 'string' }).defaultNow().notNull(),
  },
  (table) => [index('oaRichMenuAlias_oaId_idx').on(table.oaId)],
)

export const oaRichMenuUserLink = pgTable(
  'oaRichMenuUserLink',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    oaId: uuid('oaId')
      .notNull()
      .references(() => officialAccount.id, { onDelete: 'cascade' }),
    userId: text('userId').notNull(),
    richMenuId: text('richMenuId').notNull(),
    createdAt: timestamp('createdAt', { mode: 'string' }).defaultNow().notNull(),
  },
  (table) => [
    index('oaRichMenuUserLink_oaId_idx').on(table.oaId),
    index('oaRichMenuUserLink_userId_idx').on(table.userId),
  ],
)

export const oaDefaultRichMenu = pgTable('oaDefaultRichMenu', {
  oaId: uuid('oaId')
    .primaryKey()
    .references(() => officialAccount.id, { onDelete: 'cascade' }),
  richMenuId: text('richMenuId').notNull(),
  updatedAt: timestamp('updatedAt', { mode: 'string' }).notNull(),
})

export const oaRichMenuClick = pgTable(
  'oaRichMenuClick',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    oaId: uuid('oaId')
      .notNull()
      .references(() => officialAccount.id, { onDelete: 'cascade' }),
    richMenuId: text('richMenuId').notNull(),
    areaIndex: integer('areaIndex').notNull(),
    clickedAt: timestamp('clickedAt', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index('oaRichMenuClick_oaId_richMenuId_idx').on(table.oaId, table.richMenuId),
    index('oaRichMenuClick_oaId_clickedAt_idx').on(table.oaId, table.clickedAt),
  ],
)

export const oaQuota = pgTable('oaQuota', {
  oaId: uuid('oaId')
    .primaryKey()
    .references(() => officialAccount.id, { onDelete: 'cascade' }),
  monthlyLimit: integer('monthlyLimit').notNull().default(0),
  currentUsage: integer('currentUsage').notNull().default(0),
  resetAt: timestamp('resetAt', { mode: 'string' }).notNull(),
})

export const oaReplyToken = pgTable(
  'oaReplyToken',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    oaId: uuid('oaId')
      .notNull()
      .references(() => officialAccount.id, { onDelete: 'cascade' }),
    token: text('token').notNull().unique(),
    userId: text('userId').notNull(),
    chatId: uuid('chatId').notNull(),
    messageId: text('messageId'),
    used: boolean('used').notNull().default(false),
    expiresAt: timestamp('expiresAt', { mode: 'string' }).notNull(),
    createdAt: timestamp('createdAt', { mode: 'string' }).defaultNow().notNull(),
  },
  (table) => [
    index('oaReplyToken_token_idx').on(table.token),
    index('oaReplyToken_oaId_idx').on(table.oaId),
    index('oaReplyToken_expiresAt_idx').on(table.expiresAt),
  ],
)
