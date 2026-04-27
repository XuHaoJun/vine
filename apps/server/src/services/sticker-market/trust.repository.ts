import { and, desc, eq, inArray } from 'drizzle-orm'
import { creatorProfile, stickerAsset, stickerPackage } from '@vine/db/schema-public'
import { stickerTrustActionEvent, stickerTrustReport } from '@vine/db/schema-private'

export type TrustReportStatus = 'open' | 'reviewing' | 'resolved' | 'dismissed'
export type TrustReasonCategory = 'copyright' | 'prohibited_content' | 'fraud' | 'other'

export function createTrustRepository() {
  return {
    createReport(db: any, input: any) {
      return db
        .insert(stickerTrustReport)
        .values({
          id: input.id,
          packageId: input.packageId,
          reporterUserId: input.reporterUserId,
          reasonCategory: input.reasonCategory,
          reasonText: input.reasonText,
          status: 'open',
          createdAt: input.now,
          updatedAt: input.now,
        })
        .returning()
        .then((rows: any[]) => rows[0])
    },

    insertActionEvent(db: any, input: any) {
      return db.insert(stickerTrustActionEvent).values({
        id: input.id,
        reportId: input.reportId || null,
        packageId: input.packageId || null,
        creatorId: input.creatorId || null,
        actorUserId: input.actorUserId,
        action: input.action,
        reasonText: input.reasonText,
        metadataJson: input.metadataJson ?? '{}',
        createdAt: input.now,
      })
    },

    listReports(db: any, input: { status?: TrustReportStatus; limit: number }) {
      const query = db
        .select({
          id: stickerTrustReport.id,
          packageId: stickerTrustReport.packageId,
          packageName: stickerPackage.name,
          packageStatus: stickerPackage.status,
          creatorId: creatorProfile.id,
          creatorDisplayName: creatorProfile.displayName,
          reporterUserId: stickerTrustReport.reporterUserId,
          reasonCategory: stickerTrustReport.reasonCategory,
          reasonText: stickerTrustReport.reasonText,
          status: stickerTrustReport.status,
          createdAt: stickerTrustReport.createdAt,
        })
        .from(stickerTrustReport)
        .innerJoin(stickerPackage, eq(stickerTrustReport.packageId, stickerPackage.id))
        .leftJoin(creatorProfile, eq(stickerPackage.creatorId, creatorProfile.id))
      const filtered = input.status
        ? query.where(eq(stickerTrustReport.status, input.status))
        : query
      return filtered.orderBy(desc(stickerTrustReport.createdAt)).limit(input.limit)
    },

    async getReportDetail(db: any, reportId: string) {
      const [report] = await db
        .select({
          id: stickerTrustReport.id,
          packageId: stickerTrustReport.packageId,
          packageName: stickerPackage.name,
          packageStatus: stickerPackage.status,
          creatorId: creatorProfile.id,
          creatorDisplayName: creatorProfile.displayName,
          reporterUserId: stickerTrustReport.reporterUserId,
          reasonCategory: stickerTrustReport.reasonCategory,
          reasonText: stickerTrustReport.reasonText,
          status: stickerTrustReport.status,
          createdAt: stickerTrustReport.createdAt,
          creatorUserId: creatorProfile.userId,
          creatorCountry: creatorProfile.country,
          creatorBio: creatorProfile.bio,
          creatorStatus: creatorProfile.status,
          payoutHoldAt: creatorProfile.payoutHoldAt,
          payoutHoldByUserId: creatorProfile.payoutHoldByUserId,
          payoutHoldReason: creatorProfile.payoutHoldReason,
        })
        .from(stickerTrustReport)
        .innerJoin(stickerPackage, eq(stickerTrustReport.packageId, stickerPackage.id))
        .leftJoin(creatorProfile, eq(stickerPackage.creatorId, creatorProfile.id))
        .where(eq(stickerTrustReport.id, reportId))
        .limit(1)
      if (!report) return undefined
      const [pkg] = await db
        .select()
        .from(stickerPackage)
        .where(eq(stickerPackage.id, report.packageId))
        .limit(1)
      const assets = await db
        .select()
        .from(stickerAsset)
        .where(eq(stickerAsset.packageId, report.packageId))
        .orderBy(stickerAsset.number)
      const events = await db
        .select()
        .from(stickerTrustActionEvent)
        .where(eq(stickerTrustActionEvent.reportId, reportId))
        .orderBy(desc(stickerTrustActionEvent.createdAt))
      return { report, package: pkg, assets, events }
    },

    transitionReport(db: any, input: any) {
      return db
        .update(stickerTrustReport)
        .set({
          status: input.status,
          reviewedByUserId: input.actorUserId,
          resolutionText: input.resolutionText ?? null,
          resolvedAt:
            input.status === 'resolved' || input.status === 'dismissed'
              ? input.now
              : null,
          updatedAt: input.now,
        })
        .where(
          and(
            eq(stickerTrustReport.id, input.reportId),
            inArray(stickerTrustReport.status, input.fromStatuses),
          ),
        )
        .returning()
        .then((rows: any[]) => rows[0])
    },

    holdCreatorPayouts(db: any, input: any) {
      return db
        .update(creatorProfile)
        .set({
          payoutHoldAt: input.now,
          payoutHoldByUserId: input.actorUserId,
          payoutHoldReason: input.reasonText,
          updatedAt: input.now,
        })
        .where(eq(creatorProfile.id, input.creatorId))
        .returning()
        .then((rows: any[]) => rows[0])
    },

    clearCreatorPayoutHold(db: any, input: any) {
      return db
        .update(creatorProfile)
        .set({
          payoutHoldAt: null,
          payoutHoldByUserId: null,
          payoutHoldReason: null,
          updatedAt: input.now,
        })
        .where(eq(creatorProfile.id, input.creatorId))
        .returning()
        .then((rows: any[]) => rows[0])
    },
  }
}
