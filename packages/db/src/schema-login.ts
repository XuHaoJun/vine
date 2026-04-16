import { boolean, index, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'
import { oaProvider } from './schema-oa'

export const loginChannel = pgTable(
  'loginChannel',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    providerId: uuid('providerId')
      .notNull()
      .references(() => oaProvider.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    channelId: text('channelId').notNull().unique(),
    channelSecret: text('channelSecret').notNull(),
    description: text('description'),
    createdAt: timestamp('createdAt', { mode: 'string' }).defaultNow().notNull(),
    updatedAt: timestamp('updatedAt', { mode: 'string' }).defaultNow().notNull(),
  },
  (table) => [index('loginChannel_providerId_idx').on(table.providerId)],
)

export const oaLiffApp = pgTable(
  'oaLiffApp',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    loginChannelId: uuid('loginChannelId')
      .notNull()
      .references(() => loginChannel.id, { onDelete: 'cascade' }),
    liffId: text('liffId').notNull().unique(),
    viewType: text('viewType').notNull().default('full'),
    endpointUrl: text('endpointUrl').notNull(),
    moduleMode: boolean('moduleMode').default(false),
    description: text('description'),
    scopes: text('scopes').array().default(['profile', 'chat_message.write']),
    botPrompt: text('botPrompt').default('none'),
    qrCode: boolean('qrCode').default(false),
    createdAt: timestamp('createdAt', { mode: 'string' }).defaultNow().notNull(),
    updatedAt: timestamp('updatedAt', { mode: 'string' }).defaultNow().notNull(),
  },
  (table) => [
    index('oaLiffApp_loginChannelId_idx').on(table.loginChannelId),
    index('oaLiffApp_liffId_idx').on(table.liffId),
  ],
)
