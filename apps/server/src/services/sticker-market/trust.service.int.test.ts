import { eq } from 'drizzle-orm'
import { describe, expect, it } from 'vitest'
import { creatorProfile, stickerPackage } from '@vine/db/schema-public'
import { stickerTrustReport } from '@vine/db/schema-private'
import { withRollbackDb } from '../../test/integration-db'
import { createPackageRepository } from './package.repository'
import { createTrustRepository } from './trust.repository'
import { createTrustService } from './trust.service'

function createServiceWithFailingAudit(db: any) {
  const repo = createTrustRepository()
  return createTrustService({
    db,
    repo: {
      ...repo,
      insertActionEvent: async () => {
        throw new Error('audit insert failed')
      },
    },
    packageRepo: createPackageRepository(),
    createId: () => 'event_failed',
    now: () => new Date('2026-04-27T00:00:00.000Z'),
  })
}

async function seedCreatorAndPackage(db: any) {
  await db.insert(creatorProfile).values({
    id: 'creator_1',
    userId: 'user_1',
    displayName: 'Studio',
    country: 'TW',
  })
  await db.insert(stickerPackage).values({
    id: 'pkg_1',
    creatorId: 'creator_1',
    name: 'Sticker Pack',
    priceMinor: 100,
    currency: 'TWD',
    coverDriveKey: 'cover',
    tabIconDriveKey: 'tab',
    stickerCount: 8,
    status: 'on_sale',
  })
}

describe('createTrustService transactions', () => {
  it('rolls back report transitions when audit event insert fails', async () => {
    await withRollbackDb(async (db) => {
      await seedCreatorAndPackage(db)
      await db.insert(stickerTrustReport).values({
        id: 'report_1',
        packageId: 'pkg_1',
        reporterUserId: 'reporter_1',
        reasonCategory: 'copyright',
        reasonText: 'This package copies protected artwork.',
        status: 'open',
      })
      const service = createServiceWithFailingAudit(db)

      await expect(
        service.resolveReport({
          reportId: 'report_1',
          actorUserId: 'admin_1',
          resolutionText: 'Confirmed and handled.',
        }),
      ).rejects.toThrow('audit insert failed')

      const [report] = await db
        .select()
        .from(stickerTrustReport)
        .where(eq(stickerTrustReport.id, 'report_1'))
      expect(report.status).toBe('open')
      expect(report.resolutionText).toBeNull()
    })
  })

  it('rolls back package removal when audit event insert fails', async () => {
    await withRollbackDb(async (db) => {
      await seedCreatorAndPackage(db)
      const service = createServiceWithFailingAudit(db)

      await expect(
        service.forceRemovePackage({
          actorUserId: 'admin_1',
          packageId: 'pkg_1',
          reasonText: 'Confirmed infringement.',
        }),
      ).rejects.toThrow('audit insert failed')

      const [pkg] = await db
        .select()
        .from(stickerPackage)
        .where(eq(stickerPackage.id, 'pkg_1'))
      expect(pkg.status).toBe('on_sale')
    })
  })

  it('rolls back creator payout holds when audit event insert fails', async () => {
    await withRollbackDb(async (db) => {
      await seedCreatorAndPackage(db)
      const service = createServiceWithFailingAudit(db)

      await expect(
        service.holdCreatorPayouts({
          actorUserId: 'admin_1',
          creatorId: 'creator_1',
          reasonText: 'Under investigation.',
        }),
      ).rejects.toThrow('audit insert failed')

      const [creator] = await db
        .select()
        .from(creatorProfile)
        .where(eq(creatorProfile.id, 'creator_1'))
      expect(creator.payoutHoldAt).toBeNull()
      expect(creator.payoutHoldReason).toBeNull()
    })
  })
})
