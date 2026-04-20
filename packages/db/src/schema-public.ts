import {
  boolean,
  check,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'
import { officialAccount } from './schema-oa'

export const userPublic = pgTable(
  'userPublic',
  {
    id: text('id').primaryKey(),
    name: text('name'),
    username: text('username'),
    image: text('image'),
    joinedAt: timestamp('joinedAt', { mode: 'string' }).defaultNow().notNull(),
  },
  (table) => [index('userPublic_username_idx').on(table.username)],
)

export const userState = pgTable('userState', {
  userId: text('userId').primaryKey(),
  darkMode: boolean('darkMode').notNull().default(false),
})

export const todo = pgTable(
  'todo',
  {
    id: text('id').primaryKey(),
    userId: text('userId').notNull(),
    text: text('text').notNull(),
    completed: boolean('completed').notNull().default(false),
    createdAt: timestamp('createdAt', { mode: 'string' }).defaultNow().notNull(),
  },
  (table) => [index('todo_userId_idx').on(table.userId)],
)

export const friendship = pgTable(
  'friendship',
  {
    id: text('id').primaryKey(),
    requesterId: text('requesterId').notNull(),
    addresseeId: text('addresseeId').notNull(),
    status: text('status')
      .notNull()
      .$type<'pending' | 'accepted' | 'rejected' | 'blocked'>(),
    createdAt: timestamp('createdAt', { mode: 'string' }).defaultNow().notNull(),
    updatedAt: timestamp('updatedAt', { mode: 'string' }).defaultNow().notNull(),
  },
  (table) => [
    index('friendship_requesterId_idx').on(table.requesterId),
    index('friendship_addresseeId_idx').on(table.addresseeId),
  ],
)

export const chat = pgTable('chat', {
  id: text('id').primaryKey(),
  type: text('type').notNull().$type<'direct' | 'group' | 'oa'>(),
  name: text('name'),
  image: text('image'),
  description: text('description'),
  inviteCode: text('inviteCode').unique(),
  requireApproval: integer('requireApproval').notNull().default(0),
  albumCount: integer('albumCount').notNull().default(0),
  noteCount: integer('noteCount').notNull().default(0),
  lastMessageId: text('lastMessageId'),
  lastMessageAt: timestamp('lastMessageAt', { mode: 'string' }),
  createdAt: timestamp('createdAt', { mode: 'string' }).defaultNow().notNull(),
})

export const chatMember = pgTable(
  'chatMember',
  {
    id: text('id').primaryKey(),
    chatId: text('chatId').notNull(),
    userId: text('userId'),
    lastReadMessageId: text('lastReadMessageId'),
    lastReadAt: timestamp('lastReadAt', { mode: 'string' }),
    joinedAt: timestamp('joinedAt', { mode: 'string' }).defaultNow().notNull(),
    role: text('role').$type<'owner' | 'admin' | 'member'>(),
    status: text('status').$type<'pending' | 'accepted'>().notNull().default('accepted'),
    oaId: uuid('oaId').references(() => officialAccount.id),
  },
  (table) => [
    index('chatMember_chatId_idx').on(table.chatId),
    index('chatMember_userId_idx').on(table.userId),
    index('chatMember_oaId_idx').on(table.oaId),
    check(
      'chatMember_user_or_oa_check',
      sql`(${table.userId} IS NOT NULL OR ${table.oaId} IS NOT NULL)`,
    ),
    check(
      'chatMember_user_oa_mutual_exclusion_check',
      sql`(${table.userId} IS NULL OR ${table.oaId} IS NULL)`,
    ),
    check(
      'chatMember_role_oa_check',
      sql`(${table.role} IS NULL OR ${table.oaId} IS NULL)`,
    ),
    check(
      'chatMember_status_oa_check',
      sql`(${table.status} IS NULL OR ${table.oaId} IS NULL)`,
    ),
  ],
)

export const message = pgTable(
  'message',
  {
    id: text('id').primaryKey(),
    chatId: text('chatId').notNull(),
    senderId: text('senderId'),
    senderType: text('senderType').$type<'user' | 'oa'>().notNull(),
    type: text('type')
      .notNull()
      .$type<
        | 'text'
        | 'image'
        | 'video'
        | 'audio'
        | 'sticker'
        | 'location'
        | 'flex'
        | 'template'
        | 'imagemap'
      >(),
    text: text('text'),
    metadata: text('metadata'),
    replyToMessageId: text('replyToMessageId'),
    createdAt: timestamp('createdAt', { mode: 'string' }).defaultNow().notNull(),
    oaId: uuid('oaId').references(() => officialAccount.id),
  },
  (table) => [
    index('message_chatId_createdAt_idx').on(table.chatId, table.createdAt),
    index('message_oaId_idx').on(table.oaId),
    check(
      'message_sender_user_check',
      sql`(${table.senderType} = 'user' AND ${table.senderId} IS NOT NULL) OR (${table.senderType} = 'oa' AND ${table.oaId} IS NOT NULL)`,
    ),
  ],
)
