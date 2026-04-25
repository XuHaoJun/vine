import { eq, and, inArray } from 'drizzle-orm'
import { stickerPackage, stickerAsset } from '@vine/db/schema-public'
import { stickerReviewEvent } from '@vine/db/schema-private'

export type StickerPackageRow = typeof stickerPackage.$inferSelect

export function createPackageRepository() {
  return {
    async findById(db: any, packageId: string): Promise<StickerPackageRow | undefined> {
      const [row] = await db.select().from(stickerPackage).where(eq(stickerPackage.id, packageId)).limit(1)
      return row
    },

    async findOwnedPackage(db: any, input: { packageId: string; creatorId: string }): Promise<StickerPackageRow | undefined> {
      const [row] = await db
        .select()
        .from(stickerPackage)
        .where(and(eq(stickerPackage.id, input.packageId), eq(stickerPackage.creatorId, input.creatorId)))
        .limit(1)
      return row
    },

    async createDraft(db: any, input: {
      id: string
      creatorId: string
      name: string
      description: string
      priceMinor: number
      currency: string
      stickerCount: number
      tags: string
      copyrightText: string
      licenseConfirmedAt: string
      autoPublish: boolean
      now: string
    }): Promise<StickerPackageRow> {
      const [row] = await db
        .insert(stickerPackage)
        .values({
          id: input.id,
          creatorId: input.creatorId,
          name: input.name,
          description: input.description,
          priceMinor: input.priceMinor,
          currency: input.currency,
          coverDriveKey: '',
          tabIconDriveKey: '',
          stickerCount: input.stickerCount,
          status: 'draft',
          stickerType: 'static',
          locale: 'zh-TW',
          tags: input.tags,
          copyrightText: input.copyrightText,
          licenseConfirmedAt: input.licenseConfirmedAt,
          autoPublish: input.autoPublish,
          createdAt: input.now,
          updatedAt: input.now,
        })
        .returning()
      return row
    },

    async updateDraft(db: any, input: {
      packageId: string
      creatorId: string
      name: string
      description: string
      priceMinor: number
      stickerCount: number
      tags: string
      copyrightText: string
      licenseConfirmedAt: string | undefined
      autoPublish: boolean
      now: string
    }): Promise<StickerPackageRow> {
      const [row] = await db
        .update(stickerPackage)
        .set({
          name: input.name,
          description: input.description,
          priceMinor: input.priceMinor,
          stickerCount: input.stickerCount,
          tags: input.tags,
          copyrightText: input.copyrightText,
          licenseConfirmedAt: input.licenseConfirmedAt,
          autoPublish: input.autoPublish,
          updatedAt: input.now,
        })
        .where(
          and(
            eq(stickerPackage.id, input.packageId),
            eq(stickerPackage.creatorId, input.creatorId),
            inArray(stickerPackage.status, ['draft', 'rejected']),
          ),
        )
        .returning()
      if (!row) throw new Error('package not found or not editable')
      return row
    },

    async replaceAssets(db: any, input: {
      packageId: string
      coverDriveKey: string
      tabIconDriveKey: string
      assets: Array<{
        id: string
        packageId: string
        number: number
        driveKey: string
        width: number
        height: number
        sizeBytes: number
        mimeType: string
        resourceType: string
        keywords: string
      }>
      now: string
    }): Promise<void> {
      await db.transaction(async (tx: any) => {
        await tx.delete(stickerAsset).where(eq(stickerAsset.packageId, input.packageId))
        if (input.assets.length > 0) {
          await tx.insert(stickerAsset).values(input.assets)
        }
        await tx
          .update(stickerPackage)
          .set({
            coverDriveKey: input.coverDriveKey,
            tabIconDriveKey: input.tabIconDriveKey,
            updatedAt: input.now,
          })
          .where(eq(stickerPackage.id, input.packageId))
      })
    },

    async submitForReview(db: any, input: {
      packageId: string
      creatorId: string
      now: string
      eventId: string
      actorUserId: string
    }): Promise<StickerPackageRow> {
      const [row] = await db
        .update(stickerPackage)
        .set({
          status: 'in_review',
          submittedAt: input.now,
          updatedAt: input.now,
          reviewReasonCategory: null,
          reviewReasonText: null,
          reviewSuggestion: null,
          reviewProblemAssetNumbers: '[]',
        })
        .where(
          and(
            eq(stickerPackage.id, input.packageId),
            eq(stickerPackage.creatorId, input.creatorId),
            inArray(stickerPackage.status, ['draft', 'rejected']),
          ),
        )
        .returning()
      if (!row) throw new Error('package not found or not submittable')

      await db.insert(stickerReviewEvent).values({
        id: input.eventId,
        packageId: input.packageId,
        actorUserId: input.actorUserId,
        action: 'submitted',
        createdAt: input.now,
      })
      return row
    },

    async approve(db: any, input: {
      packageId: string
      actorUserId: string
      eventId: string
      now: string
    }): Promise<StickerPackageRow> {
      const [pkg] = await db
        .select()
        .from(stickerPackage)
        .where(and(eq(stickerPackage.id, input.packageId), eq(stickerPackage.status, 'in_review')))
        .limit(1)
      if (!pkg) throw new Error('package not found or not in review')

      const nextStatus = pkg.autoPublish ? 'on_sale' : 'approved'
      const [row] = await db
        .update(stickerPackage)
        .set({
          status: nextStatus,
          reviewedAt: input.now,
          publishedAt: nextStatus === 'on_sale' ? input.now : null,
          updatedAt: input.now,
        })
        .where(eq(stickerPackage.id, input.packageId))
        .returning()

      await db.insert(stickerReviewEvent).values({
        id: input.eventId,
        packageId: input.packageId,
        actorUserId: input.actorUserId,
        action: 'approved',
        createdAt: input.now,
      })
      return row
    },

    async reject(db: any, input: {
      packageId: string
      actorUserId: string
      reasonCategory: string
      reasonText: string
      suggestion: string
      problemAssetNumbers: number[]
      eventId: string
      now: string
    }): Promise<StickerPackageRow> {
      const [pkg] = await db
        .select()
        .from(stickerPackage)
        .where(and(eq(stickerPackage.id, input.packageId), eq(stickerPackage.status, 'in_review')))
        .limit(1)
      if (!pkg) throw new Error('package not found or not in review')

      const [row] = await db
        .update(stickerPackage)
        .set({
          status: 'rejected',
          reviewedAt: input.now,
          reviewReasonCategory: input.reasonCategory,
          reviewReasonText: input.reasonText,
          reviewSuggestion: input.suggestion,
          reviewProblemAssetNumbers: JSON.stringify(input.problemAssetNumbers),
          updatedAt: input.now,
        })
        .where(eq(stickerPackage.id, input.packageId))
        .returning()

      await db.insert(stickerReviewEvent).values({
        id: input.eventId,
        packageId: input.packageId,
        actorUserId: input.actorUserId,
        action: 'rejected',
        reasonCategory: input.reasonCategory,
        reasonText: input.reasonText,
        suggestion: input.suggestion,
        problemAssetNumbers: JSON.stringify(input.problemAssetNumbers),
        createdAt: input.now,
      })
      return row
    },

    async publishApproved(db: any, input: {
      packageId: string
      creatorId: string
      now: string
    }): Promise<StickerPackageRow> {
      const [row] = await db
        .update(stickerPackage)
        .set({
          status: 'on_sale',
          publishedAt: input.now,
          updatedAt: input.now,
        })
        .where(
          and(
            eq(stickerPackage.id, input.packageId),
            eq(stickerPackage.creatorId, input.creatorId),
            eq(stickerPackage.status, 'approved'),
          ),
        )
        .returning()
      if (!row) throw new Error('package not found or not approved')
      return row
    },

    async listReviewQueue(db: any, input: { limit: number }): Promise<StickerPackageRow[]> {
      return db
        .select()
        .from(stickerPackage)
        .where(eq(stickerPackage.status, 'in_review'))
        .orderBy(stickerPackage.submittedAt)
        .limit(input.limit)
    },

    async findByIdWithAssets(db: any, packageId: string): Promise<{ package: StickerPackageRow; assets: any[] }> {
      const [pkg] = await db.select().from(stickerPackage).where(eq(stickerPackage.id, packageId)).limit(1)
      const assets = await db.select().from(stickerAsset).where(eq(stickerAsset.packageId, packageId)).orderBy(stickerAsset.number)
      return { package: pkg, assets }
    },
  }
}
