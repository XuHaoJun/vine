import { Code, ConnectError } from '@connectrpc/connect'

const reasonCategories = new Set([
  'copyright',
  'prohibited_content',
  'fraud',
  'other',
])

function requireReason(value: string, min = 1) {
  const trimmed = value.trim()
  if (trimmed.length < min) {
    throw new ConnectError('reason is required', Code.InvalidArgument)
  }
  if (trimmed.length > 1000) {
    throw new ConnectError('reason must be 1000 characters or fewer', Code.InvalidArgument)
  }
  return trimmed
}

export function createTrustService(deps: {
  db: any
  repo: any
  packageRepo: any
  createId: () => string
  now: () => Date
}) {
  const nowIso = () => deps.now().toISOString()

  return {
    async reportStickerPackage(input: {
      packageId: string
      reporterUserId: string
      reasonCategory: string
      reasonText: string
    }) {
      if (!reasonCategories.has(input.reasonCategory)) {
        throw new ConnectError('invalid report category', Code.InvalidArgument)
      }
      const reasonText = requireReason(input.reasonText, 10)
      const pkg = await deps.packageRepo.findById(deps.db, input.packageId)
      if (!pkg) throw new ConnectError('package not found', Code.NotFound)
      if (pkg.status !== 'on_sale') {
        throw new ConnectError('package is not reportable', Code.FailedPrecondition)
      }
      const now = nowIso()
      const report = await deps.repo.createReport(deps.db, {
        id: deps.createId(),
        packageId: input.packageId,
        reporterUserId: input.reporterUserId,
        reasonCategory: input.reasonCategory,
        reasonText,
        now,
      })
      await deps.repo.insertActionEvent(deps.db, {
        id: deps.createId(),
        reportId: report.id,
        packageId: input.packageId,
        creatorId: pkg.creatorId,
        actorUserId: input.reporterUserId,
        action: 'report_created',
        reasonText,
        metadataJson: JSON.stringify({ reasonCategory: input.reasonCategory }),
        now,
      })
      return report
    },

    listReports(input: { status?: string; limit: number }) {
      const status =
        input.status && ['open', 'reviewing', 'resolved', 'dismissed'].includes(input.status)
          ? input.status
          : undefined
      return deps.repo.listReports(deps.db, {
        status,
        limit: input.limit > 0 ? input.limit : 50,
      })
    },

    async getReportDetail(input: { reportId: string }) {
      const detail = await deps.repo.getReportDetail(deps.db, input.reportId)
      if (!detail) throw new ConnectError('report not found', Code.NotFound)
      return detail
    },

    async markReviewing(input: { reportId: string; actorUserId: string; note: string }) {
      const now = nowIso()
      const report = await deps.repo.transitionReport(deps.db, {
        reportId: input.reportId,
        actorUserId: input.actorUserId,
        status: 'reviewing',
        fromStatuses: ['open'],
        now,
      })
      if (!report) throw new ConnectError('report is not open', Code.FailedPrecondition)
      await deps.repo.insertActionEvent(deps.db, {
        id: deps.createId(),
        reportId: report.id,
        packageId: report.packageId,
        actorUserId: input.actorUserId,
        action: 'report_reviewing',
        reasonText: input.note.trim(),
        metadataJson: '{}',
        now,
      })
      return report
    },

    async resolveReport(input: {
      reportId: string
      actorUserId: string
      resolutionText: string
    }) {
      return transitionClosed('resolved', 'report_resolved', input)
    },

    async dismissReport(input: {
      reportId: string
      actorUserId: string
      resolutionText: string
    }) {
      return transitionClosed('dismissed', 'report_dismissed', input)
    },

    async forceRemovePackage(input: {
      actorUserId: string
      packageId: string
      reportId?: string
      reasonText: string
    }) {
      const reasonText = requireReason(input.reasonText)
      const now = nowIso()
      const pkg = await deps.packageRepo.forceRemove(deps.db, {
        packageId: input.packageId,
        now,
      })
      await deps.repo.insertActionEvent(deps.db, {
        id: deps.createId(),
        reportId: input.reportId || null,
        packageId: pkg.id,
        creatorId: pkg.creatorId,
        actorUserId: input.actorUserId,
        action: 'package_removed',
        reasonText,
        metadataJson: '{}',
        now,
      })
      return pkg
    },

    async restorePackage(input: {
      actorUserId: string
      packageId: string
      reportId?: string
      reasonText: string
    }) {
      const reasonText = requireReason(input.reasonText)
      const now = nowIso()
      const pkg = await deps.packageRepo.restoreRemoved(deps.db, {
        packageId: input.packageId,
        now,
      })
      await deps.repo.insertActionEvent(deps.db, {
        id: deps.createId(),
        reportId: input.reportId || null,
        packageId: pkg.id,
        creatorId: pkg.creatorId,
        actorUserId: input.actorUserId,
        action: 'package_restored',
        reasonText,
        metadataJson: '{}',
        now,
      })
      return pkg
    },

    async holdCreatorPayouts(input: {
      actorUserId: string
      creatorId: string
      reportId?: string
      packageId?: string
      reasonText: string
    }) {
      const reasonText = requireReason(input.reasonText)
      const now = nowIso()
      const creator = await deps.repo.holdCreatorPayouts(deps.db, {
        ...input,
        reasonText,
        now,
      })
      if (!creator) throw new ConnectError('creator not found', Code.NotFound)
      await deps.repo.insertActionEvent(deps.db, {
        id: deps.createId(),
        reportId: input.reportId || null,
        packageId: input.packageId || null,
        creatorId: input.creatorId,
        actorUserId: input.actorUserId,
        action: 'creator_payout_hold_enabled',
        reasonText,
        metadataJson: '{}',
        now,
      })
      return creator
    },

    async clearCreatorPayoutHold(input: {
      actorUserId: string
      creatorId: string
      reportId?: string
      packageId?: string
      reasonText: string
    }) {
      const reasonText = requireReason(input.reasonText)
      const now = nowIso()
      const creator = await deps.repo.clearCreatorPayoutHold(deps.db, {
        ...input,
        reasonText,
        now,
      })
      if (!creator) throw new ConnectError('creator not found', Code.NotFound)
      await deps.repo.insertActionEvent(deps.db, {
        id: deps.createId(),
        reportId: input.reportId || null,
        packageId: input.packageId || null,
        creatorId: input.creatorId,
        actorUserId: input.actorUserId,
        action: 'creator_payout_hold_cleared',
        reasonText,
        metadataJson: '{}',
        now,
      })
      return creator
    },
  }

  async function transitionClosed(
    status: 'resolved' | 'dismissed',
    action: 'report_resolved' | 'report_dismissed',
    input: { reportId: string; actorUserId: string; resolutionText: string },
  ) {
    const resolutionText = requireReason(input.resolutionText)
    const now = nowIso()
    const report = await deps.repo.transitionReport(deps.db, {
      reportId: input.reportId,
      actorUserId: input.actorUserId,
      status,
      fromStatuses: ['open', 'reviewing'],
      resolutionText,
      now,
    })
    if (!report) {
      throw new ConnectError('report is not open or reviewing', Code.FailedPrecondition)
    }
    await deps.repo.insertActionEvent(deps.db, {
      id: deps.createId(),
      reportId: report.id,
      packageId: report.packageId,
      actorUserId: input.actorUserId,
      action,
      reasonText: resolutionText,
      metadataJson: '{}',
      now,
    })
    return report
  }
}
