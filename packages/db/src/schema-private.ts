import { sql } from 'drizzle-orm'
import { index, integer, pgTable, text, timestamp, uniqueIndex } from 'drizzle-orm/pg-core'

import type { InferSelectModel } from 'drizzle-orm'
import { stickerPackage } from './schema-public'

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

export const stickerReviewEvent = pgTable(
  'stickerReviewEvent',
  {
    id: text('id').primaryKey(),
    packageId: text('packageId')
      .notNull()
      .references(() => stickerPackage.id),
    actorUserId: text('actorUserId').notNull(),
    action: text('action').notNull().$type<'submitted' | 'approved' | 'rejected'>(),
    reasonCategory: text('reasonCategory'),
    reasonText: text('reasonText'),
    suggestion: text('suggestion'),
    problemAssetNumbers: text('problemAssetNumbers').notNull().default('[]'),
    createdAt: timestamp('createdAt', { mode: 'string' }).defaultNow().notNull(),
  },
  (table) => [index('stickerReviewEvent_packageId_idx').on(table.packageId)],
)

export const creatorPayoutAccount = pgTable(
  'creatorPayoutAccount',
  {
    id: text('id').primaryKey(),
    creatorId: text('creatorId').notNull(),
    legalName: text('legalName').notNull(),
    bankCode: text('bankCode').notNull(),
    bankName: text('bankName').notNull(),
    branchName: text('branchName').notNull().default(''),
    accountNumber: text('accountNumber').notNull(),
    accountLast4: text('accountLast4').notNull(),
    currency: text('currency').notNull().$type<'TWD'>().default('TWD'),
    status: text('status').notNull().$type<'active' | 'disabled'>().default('active'),
    createdAt: timestamp('createdAt', { mode: 'string' }).defaultNow().notNull(),
    updatedAt: timestamp('updatedAt', { mode: 'string' }).defaultNow().notNull(),
  },
  (table) => [
    index('creatorPayoutAccount_creatorId_idx').on(table.creatorId),
    uniqueIndex('creatorPayoutAccount_creatorId_active_unique')
      .on(table.creatorId)
      .where(sql`${table.status} = 'active'`),
  ],
)

export const creatorPayoutLedger = pgTable(
  'creatorPayoutLedger',
  {
    id: text('id').primaryKey(),
    creatorId: text('creatorId').notNull(),
    month: text('month').notNull(),
    currency: text('currency').notNull().$type<'TWD'>().default('TWD'),
    grossAmountMinor: integer('grossAmountMinor').notNull(),
    refundedAmountMinor: integer('refundedAmountMinor').notNull().default(0),
    platformFeeMinor: integer('platformFeeMinor').notNull(),
    creatorShareMinor: integer('creatorShareMinor').notNull(),
    taxWithholdingMinor: integer('taxWithholdingMinor').notNull().default(0),
    transferFeeMinor: integer('transferFeeMinor').notNull().default(0),
    netAmountMinor: integer('netAmountMinor').notNull(),
    status: text('status')
      .notNull()
      .$type<'available' | 'requested' | 'locked' | 'paid' | 'void'>()
      .default('available'),
    createdAt: timestamp('createdAt', { mode: 'string' }).defaultNow().notNull(),
    updatedAt: timestamp('updatedAt', { mode: 'string' }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('creatorPayoutLedger_creator_month_unique').on(table.creatorId, table.month),
    index('creatorPayoutLedger_status_idx').on(table.status),
  ],
)

export const creatorPayoutBatch = pgTable(
  'creatorPayoutBatch',
  {
    id: text('id').primaryKey(),
    status: text('status')
      .notNull()
      .$type<'draft' | 'exported' | 'paid' | 'closed'>()
      .default('draft'),
    exportedAt: timestamp('exportedAt', { mode: 'string' }),
    exportedByUserId: text('exportedByUserId'),
    paidAt: timestamp('paidAt', { mode: 'string' }),
    createdByUserId: text('createdByUserId').notNull(),
    createdAt: timestamp('createdAt', { mode: 'string' }).defaultNow().notNull(),
    updatedAt: timestamp('updatedAt', { mode: 'string' }).defaultNow().notNull(),
  },
  (table) => [index('creatorPayoutBatch_status_idx').on(table.status)],
)

export const creatorPayoutRequest = pgTable(
  'creatorPayoutRequest',
  {
    id: text('id').primaryKey(),
    ledgerIdsJson: text('ledgerIdsJson').notNull().default('[]'),
    creatorId: text('creatorId').notNull(),
    payoutAccountId: text('payoutAccountId').notNull(),
    batchId: text('batchId'),
    currency: text('currency').notNull().$type<'TWD'>().default('TWD'),
    grossAmountMinor: integer('grossAmountMinor').notNull(),
    taxWithholdingMinor: integer('taxWithholdingMinor').notNull().default(0),
    transferFeeMinor: integer('transferFeeMinor').notNull().default(0),
    netAmountMinor: integer('netAmountMinor').notNull(),
    status: text('status')
      .notNull()
      .$type<'requested' | 'approved' | 'exported' | 'paid' | 'rejected' | 'failed'>()
      .default('requested'),
    rejectReason: text('rejectReason'),
    failureReason: text('failureReason'),
    bankTransactionId: text('bankTransactionId'),
    paidAt: timestamp('paidAt', { mode: 'string' }),
    requestedAt: timestamp('requestedAt', { mode: 'string' }).defaultNow().notNull(),
    reviewedAt: timestamp('reviewedAt', { mode: 'string' }),
    reviewedByUserId: text('reviewedByUserId'),
    updatedAt: timestamp('updatedAt', { mode: 'string' }).defaultNow().notNull(),
  },
  (table) => [
    index('creatorPayoutRequest_creatorId_idx').on(table.creatorId),
    index('creatorPayoutRequest_status_idx').on(table.status),
    index('creatorPayoutRequest_batchId_idx').on(table.batchId),
  ],
)

export const creatorPayoutAuditEvent = pgTable(
  'creatorPayoutAuditEvent',
  {
    id: text('id').primaryKey(),
    payoutRequestId: text('payoutRequestId'),
    payoutBatchId: text('payoutBatchId'),
    actorUserId: text('actorUserId').notNull(),
    action: text('action').notNull(),
    metadataJson: text('metadataJson').notNull().default('{}'),
    createdAt: timestamp('createdAt', { mode: 'string' }).defaultNow().notNull(),
  },
  (table) => [
    index('creatorPayoutAuditEvent_request_idx').on(table.payoutRequestId),
    index('creatorPayoutAuditEvent_batch_idx').on(table.payoutBatchId),
  ],
)
