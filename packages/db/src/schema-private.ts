import { index, integer, pgTable, text, timestamp } from 'drizzle-orm/pg-core'

import type { InferSelectModel } from 'drizzle-orm'

export const user = pgTable('user', (t) => ({
  id: t.varchar('id').primaryKey(),
  username: t.varchar('username', { length: 200 }),
  name: t.varchar('name', { length: 200 }),
  email: t.varchar('email', { length: 200 }).notNull().unique(),
  normalizedEmail: t.varchar('normalizedEmail', { length: 200 }).unique(),
  updatedAt: t.timestamp('updatedAt', { mode: 'string' }).defaultNow(),
  emailVerified: t.boolean('emailVerified').default(false).notNull(),
  image: t.text('image'),
  createdAt: t.timestamp('createdAt', { mode: 'string' }).defaultNow(),
  role: t.varchar('role').default('user').notNull(),
  banned: t.boolean('banned').default(false).notNull(),
  banReason: t.varchar('banReason'),
  banExpires: t.bigint('banExpires', { mode: 'number' }),
}))

export type UserPrivate = InferSelectModel<typeof user>

export const account = pgTable('account', (t) => ({
  id: t.text('id').primaryKey().notNull(),
  accountId: t.text('accountId').notNull(),
  providerId: t.text('providerId').notNull(),
  userId: t
    .text('userId')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  accessToken: t.text('accessToken'),
  refreshToken: t.text('refreshToken'),
  idToken: t.text('idToken'),
  accessTokenExpiresAt: t.timestamp('accessTokenExpiresAt', { mode: 'string' }),
  refreshTokenExpiresAt: t.timestamp('refreshTokenExpiresAt', { mode: 'string' }),
  scope: t.text('scope'),
  password: t.text('password'),
  createdAt: t.timestamp('createdAt', { mode: 'string' }).notNull(),
  updatedAt: t.timestamp('updatedAt', { mode: 'string' }).notNull(),
}))

export const session = pgTable('session', (t) => ({
  id: t.text('id').primaryKey().notNull(),
  expiresAt: t.timestamp('expiresAt', { mode: 'string' }).notNull(),
  token: t.text('token').notNull(),
  createdAt: t.timestamp('createdAt', { mode: 'string' }).notNull(),
  updatedAt: t.timestamp('updatedAt', { mode: 'string' }).notNull(),
  ipAddress: t.text('ipAddress'),
  userAgent: t.text('userAgent'),
  userId: t
    .text('userId')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  impersonatedBy: t.varchar('impersonatedBy'),
}))

export const jwks = pgTable('jwks', (t) => ({
  id: t.text('id').primaryKey().notNull(),
  publicKey: t.text('publicKey').notNull(),
  privateKey: t.text('privateKey').notNull(),
  createdAt: t.timestamp('createdAt', { mode: 'string' }).notNull(),
}))

export const verification = pgTable('verification', (t) => ({
  id: t.text('id').primaryKey().notNull(),
  identifier: t.text('identifier').notNull(),
  value: t.text('value').notNull(),
  expiresAt: t.timestamp('expiresAt', { mode: 'string' }).notNull(),
  createdAt: t.timestamp('createdAt', { mode: 'string' }),
  updatedAt: t.timestamp('updatedAt', { mode: 'string' }),
}))

export const stickerOrder = pgTable(
  'stickerOrder',
  {
    id: text('id').primaryKey(),
    userId: text('userId').notNull(),
    packageId: text('packageId').notNull(),
    amountMinor: integer('amountMinor').notNull(),
    currency: text('currency').notNull().$type<'TWD'>(),
    status: text('status')
      .notNull()
      .$type<
        'created' | 'paid' | 'failed' | 'refund_pending' | 'refunded' | 'refund_failed'
      >()
      .default('created'),
    connectorName: text('connectorName').notNull().$type<'ecpay'>(),
    connectorChargeId: text('connectorChargeId'),
    paidAt: timestamp('paidAt', { mode: 'string' }),
    failureReason: text('failureReason'),
    refundId: text('refundId'),
    refundAmountMinor: integer('refundAmountMinor'),
    refundReason: text('refundReason'),
    refundRequestedAt: timestamp('refundRequestedAt', { mode: 'string' }),
    refundedAt: timestamp('refundedAt', { mode: 'string' }),
    refundFailureReason: text('refundFailureReason'),
    refundRequestedByUserId: text('refundRequestedByUserId'),
    lastReconciledAt: timestamp('lastReconciledAt', { mode: 'string' }),
    lastConnectorStatus: text('lastConnectorStatus'),
    lastReconciliationMismatch: text('lastReconciliationMismatch'),
    createdAt: timestamp('createdAt', { mode: 'string' }).defaultNow().notNull(),
    updatedAt: timestamp('updatedAt', { mode: 'string' }).defaultNow().notNull(),
  },
  (table) => [
    index('stickerOrder_userId_idx').on(table.userId),
    index('stickerOrder_status_idx').on(table.status),
  ],
)
