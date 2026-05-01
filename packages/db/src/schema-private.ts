import { sql } from 'drizzle-orm'
import {
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core'

import type { InferSelectModel } from 'drizzle-orm'
import { officialAccount } from './schema-oa'
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
    uniqueIndex('creatorPayoutLedger_creator_month_unique').on(
      table.creatorId,
      table.month,
    ),
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

export const stickerFeaturedShelf = pgTable(
  'stickerFeaturedShelf',
  {
    id: text('id').primaryKey(),
    slug: text('slug').notNull(),
    title: text('title').notNull(),
    status: text('status')
      .notNull()
      .$type<'draft' | 'published' | 'archived'>()
      .default('draft'),
    startsAt: timestamp('startsAt', { mode: 'string' }),
    endsAt: timestamp('endsAt', { mode: 'string' }),
    createdByUserId: text('createdByUserId').notNull(),
    createdAt: timestamp('createdAt', { mode: 'string' }).defaultNow().notNull(),
    updatedAt: timestamp('updatedAt', { mode: 'string' }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('stickerFeaturedShelf_slug_unique').on(table.slug),
    index('stickerFeaturedShelf_status_starts_ends_idx').on(
      table.status,
      table.startsAt,
      table.endsAt,
    ),
  ],
)

export const stickerFeaturedShelfItem = pgTable(
  'stickerFeaturedShelfItem',
  {
    id: text('id').primaryKey(),
    shelfId: text('shelfId').notNull(),
    packageId: text('packageId').notNull(),
    position: integer('position').notNull(),
    createdAt: timestamp('createdAt', { mode: 'string' }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('stickerFeaturedShelfItem_shelf_package_unique').on(
      table.shelfId,
      table.packageId,
    ),
    uniqueIndex('stickerFeaturedShelfItem_shelf_position_unique').on(
      table.shelfId,
      table.position,
    ),
  ],
)

export const currencyDisplayRate = pgTable(
  'currencyDisplayRate',
  {
    id: text('id').primaryKey(),
    baseCurrency: text('baseCurrency').notNull(),
    quoteCurrency: text('quoteCurrency').notNull(),
    rate: text('rate').notNull(),
    source: text('source').notNull(),
    effectiveDate: timestamp('effectiveDate', { mode: 'string' }).notNull(),
    createdAt: timestamp('createdAt', { mode: 'string' }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('currencyDisplayRate_base_quote_date_unique').on(
      table.baseCurrency,
      table.quoteCurrency,
      table.effectiveDate,
    ),
    index('currencyDisplayRate_quote_date_idx').on(
      table.quoteCurrency,
      table.effectiveDate,
    ),
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

export const stickerTrustReport = pgTable(
  'stickerTrustReport',
  {
    id: text('id').primaryKey(),
    packageId: text('packageId')
      .notNull()
      .references(() => stickerPackage.id),
    reporterUserId: text('reporterUserId').notNull(),
    reasonCategory: text('reasonCategory')
      .notNull()
      .$type<'copyright' | 'prohibited_content' | 'fraud' | 'other'>(),
    reasonText: text('reasonText').notNull(),
    status: text('status')
      .notNull()
      .$type<'open' | 'reviewing' | 'resolved' | 'dismissed'>()
      .default('open'),
    reviewedByUserId: text('reviewedByUserId'),
    resolutionText: text('resolutionText'),
    resolvedAt: timestamp('resolvedAt', { mode: 'string' }),
    createdAt: timestamp('createdAt', { mode: 'string' }).defaultNow().notNull(),
    updatedAt: timestamp('updatedAt', { mode: 'string' }).defaultNow().notNull(),
  },
  (table) => [
    index('stickerTrustReport_packageId_idx').on(table.packageId),
    index('stickerTrustReport_reporterUserId_idx').on(table.reporterUserId),
    index('stickerTrustReport_status_idx').on(table.status),
  ],
)

export const stickerTrustActionEvent = pgTable(
  'stickerTrustActionEvent',
  {
    id: text('id').primaryKey(),
    reportId: text('reportId').references(() => stickerTrustReport.id),
    packageId: text('packageId').references(() => stickerPackage.id),
    creatorId: text('creatorId'),
    actorUserId: text('actorUserId').notNull(),
    action: text('action')
      .notNull()
      .$type<
        | 'report_created'
        | 'report_reviewing'
        | 'report_resolved'
        | 'report_dismissed'
        | 'package_removed'
        | 'package_restored'
        | 'creator_payout_hold_enabled'
        | 'creator_payout_hold_cleared'
      >(),
    reasonText: text('reasonText').notNull().default(''),
    metadataJson: text('metadataJson').notNull().default('{}'),
    createdAt: timestamp('createdAt', { mode: 'string' }).defaultNow().notNull(),
  },
  (table) => [
    index('stickerTrustActionEvent_reportId_idx').on(table.reportId),
    index('stickerTrustActionEvent_packageId_idx').on(table.packageId),
    index('stickerTrustActionEvent_creatorId_idx').on(table.creatorId),
  ],
)

export const oaMessageRequest = pgTable(
  'oaMessageRequest',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    oaId: uuid('oaId')
      .notNull()
      .references(() => officialAccount.id, { onDelete: 'cascade' }),
    requestType: text('requestType').notNull(),
    retryKey: text('retryKey'),
    requestHash: text('requestHash').notNull(),
    acceptedRequestId: text('acceptedRequestId').notNull(),
    status: text('status').notNull().default('accepted'),
    messagesJson: jsonb('messagesJson').notNull(),
    targetJson: jsonb('targetJson'),
    errorCode: text('errorCode'),
    errorMessage: text('errorMessage'),
    createdAt: timestamp('createdAt', { mode: 'string' }).defaultNow().notNull(),
    updatedAt: timestamp('updatedAt', { mode: 'string' }).defaultNow().notNull(),
    completedAt: timestamp('completedAt', { mode: 'string' }),
    expiresAt: timestamp('expiresAt', { mode: 'string' }),
  },
  (table) => [
    index('oaMessageRequest_oaId_type_createdAt_idx').on(
      table.oaId,
      table.requestType,
      table.createdAt,
    ),
    index('oaMessageRequest_status_idx').on(table.status),
    uniqueIndex('oaMessageRequest_acceptedRequestId_idx').on(table.acceptedRequestId),
  ],
)

export const oaMessageDelivery = pgTable(
  'oaMessageDelivery',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    requestId: uuid('requestId')
      .notNull()
      .references(() => oaMessageRequest.id, { onDelete: 'cascade' }),
    oaId: uuid('oaId')
      .notNull()
      .references(() => officialAccount.id, { onDelete: 'cascade' }),
    userId: text('userId').notNull(),
    chatId: text('chatId'),
    status: text('status').notNull().default('pending'),
    messageIdsJson: jsonb('messageIdsJson').notNull(),
    attemptCount: integer('attemptCount').notNull().default(0),
    lastErrorCode: text('lastErrorCode'),
    lastErrorMessage: text('lastErrorMessage'),
    lockedAt: timestamp('lockedAt', { mode: 'string' }),
    lockedBy: text('lockedBy'),
    createdAt: timestamp('createdAt', { mode: 'string' }).defaultNow().notNull(),
    updatedAt: timestamp('updatedAt', { mode: 'string' }).defaultNow().notNull(),
    deliveredAt: timestamp('deliveredAt', { mode: 'string' }),
  },
  (table) => [
    uniqueIndex('oaMessageDelivery_request_user_idx').on(table.requestId, table.userId),
    index('oaMessageDelivery_status_lockedAt_idx').on(table.status, table.lockedAt),
    index('oaMessageDelivery_oaId_userId_idx').on(table.oaId, table.userId),
    index('oaMessageDelivery_requestId_idx').on(table.requestId),
  ],
)

export const oaRetryKey = pgTable(
  'oaRetryKey',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    oaId: uuid('oaId')
      .notNull()
      .references(() => officialAccount.id, { onDelete: 'cascade' }),
    retryKey: text('retryKey').notNull(),
    requestId: uuid('requestId')
      .notNull()
      .references(() => oaMessageRequest.id, { onDelete: 'cascade' }),
    requestHash: text('requestHash').notNull(),
    acceptedRequestId: text('acceptedRequestId').notNull(),
    expiresAt: timestamp('expiresAt', { mode: 'string' }).notNull(),
    createdAt: timestamp('createdAt', { mode: 'string' }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('oaRetryKey_oaId_retryKey_idx').on(table.oaId, table.retryKey),
    index('oaRetryKey_expiresAt_idx').on(table.expiresAt),
  ],
)
