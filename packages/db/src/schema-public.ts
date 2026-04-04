import {
  boolean,
  index,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core'

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
  lastMessageId: text('lastMessageId'),
  lastMessageAt: timestamp('lastMessageAt', { mode: 'string' }),
  createdAt: timestamp('createdAt', { mode: 'string' }).defaultNow().notNull(),
})

export const chatMember = pgTable(
  'chatMember',
  {
    id: text('id').primaryKey(),
    chatId: text('chatId').notNull(),
    userId: text('userId').notNull(),
    lastReadMessageId: text('lastReadMessageId'),
    lastReadAt: timestamp('lastReadAt', { mode: 'string' }),
    joinedAt: timestamp('joinedAt', { mode: 'string' }).defaultNow().notNull(),
    oaId: text('oaId'),
  },
  (table) => [
    index('chatMember_chatId_idx').on(table.chatId),
    index('chatMember_userId_idx').on(table.userId),
    uniqueIndex('chatMember_chatId_userId_unique').on(table.chatId, table.userId),
  ],
)

export const message = pgTable(
  'message',
  {
    id: text('id').primaryKey(),
    chatId: text('chatId').notNull(),
    senderId: text('senderId').notNull(),
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
      >(),
    text: text('text'),
    metadata: text('metadata'),
    replyToMessageId: text('replyToMessageId'),
    createdAt: timestamp('createdAt', { mode: 'string' }).defaultNow().notNull(),
    oaId: text('oaId'),
  },
  (table) => [index('message_chatId_createdAt_idx').on(table.chatId, table.createdAt)],
)
