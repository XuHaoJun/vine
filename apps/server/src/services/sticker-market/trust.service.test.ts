import { Code, ConnectError } from '@connectrpc/connect'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createTrustService } from './trust.service'

function makeDeps() {
  const tx = { tx: true }
  const repo = {
    createReport: vi.fn(),
    insertActionEvent: vi.fn(),
    listReports: vi.fn(),
    getReportDetail: vi.fn(),
    transitionReport: vi.fn(),
    holdCreatorPayouts: vi.fn(),
    clearCreatorPayoutHold: vi.fn(),
  }
  const packageRepo = {
    findById: vi.fn(),
    forceRemove: vi.fn(),
    restoreRemoved: vi.fn(),
  }
  const deps = {
    db: { transaction: vi.fn((fn: (tx: any) => Promise<any>) => fn(tx)) },
    tx,
    repo,
    packageRepo,
    createId: vi.fn(),
    now: vi.fn(),
  }
  deps.createId.mockReturnValueOnce('report-1').mockReturnValueOnce('event-1')
  deps.now.mockReturnValue(new Date('2026-04-27T00:00:00.000Z'))
  return deps
}

describe('createTrustService', () => {
  beforeEach(() => vi.clearAllMocks())

  it('creates an open report and audit event for an on-sale package', async () => {
    const deps = makeDeps()
    deps.packageRepo.findById.mockResolvedValue({
      id: 'pkg-1',
      creatorId: 'creator-1',
      status: 'on_sale',
    })
    deps.repo.createReport.mockResolvedValue({
      id: 'report-1',
      packageId: 'pkg-1',
      reporterUserId: 'user-1',
      reasonCategory: 'copyright',
      reasonText: 'This looks copied from my artwork.',
      status: 'open',
      createdAt: '2026-04-27T00:00:00.000Z',
    })
    const service = createTrustService(deps)

    const report = await service.reportStickerPackage({
      packageId: 'pkg-1',
      reporterUserId: 'user-1',
      reasonCategory: 'copyright',
      reasonText: ' This looks copied from my artwork. ',
    })

    expect(report.id).toBe('report-1')
    expect(deps.db.transaction).toHaveBeenCalled()
    expect(deps.repo.createReport).toHaveBeenCalledWith(deps.tx, {
      id: 'report-1',
      packageId: 'pkg-1',
      reporterUserId: 'user-1',
      reasonCategory: 'copyright',
      reasonText: 'This looks copied from my artwork.',
      now: '2026-04-27T00:00:00.000Z',
    })
    expect(deps.repo.insertActionEvent).toHaveBeenCalledWith(deps.tx, {
      id: 'event-1',
      reportId: 'report-1',
      packageId: 'pkg-1',
      creatorId: 'creator-1',
      actorUserId: 'user-1',
      action: 'report_created',
      reasonText: 'This looks copied from my artwork.',
      metadataJson: JSON.stringify({ reasonCategory: 'copyright' }),
      now: '2026-04-27T00:00:00.000Z',
    })
  })

  it('rejects invalid reason categories', async () => {
    const service = createTrustService(makeDeps())
    await expect(
      service.reportStickerPackage({
        packageId: 'pkg-1',
        reporterUserId: 'user-1',
        reasonCategory: 'spam',
        reasonText: 'This reason has enough characters.',
      }),
    ).rejects.toMatchObject({ code: Code.InvalidArgument })
  })

  it('rejects short reasons', async () => {
    const service = createTrustService(makeDeps())
    await expect(
      service.reportStickerPackage({
        packageId: 'pkg-1',
        reporterUserId: 'user-1',
        reasonCategory: 'copyright',
        reasonText: 'short',
      }),
    ).rejects.toMatchObject({ code: Code.InvalidArgument })
  })

  it('rejects reports for packages that are not on sale', async () => {
    const deps = makeDeps()
    deps.packageRepo.findById.mockResolvedValue({ id: 'pkg-1', status: 'approved' })
    const service = createTrustService(deps)
    await expect(
      service.reportStickerPackage({
        packageId: 'pkg-1',
        reporterUserId: 'user-1',
        reasonCategory: 'copyright',
        reasonText: 'This reason has enough characters.',
      }),
    ).rejects.toMatchObject({ code: Code.FailedPrecondition })
  })

  it('force removes packages and writes an action event', async () => {
    const deps = makeDeps()
    deps.createId.mockReset()
    deps.createId.mockReturnValue('event-1')
    deps.packageRepo.forceRemove.mockResolvedValue({
      id: 'pkg-1',
      creatorId: 'creator-1',
      status: 'removed',
    })
    const service = createTrustService(deps)

    await service.forceRemovePackage({
      actorUserId: 'admin-1',
      packageId: 'pkg-1',
      reportId: 'report-1',
      reasonText: 'Confirmed infringement.',
    })

    expect(deps.db.transaction).toHaveBeenCalled()
    expect(deps.packageRepo.forceRemove).toHaveBeenCalledWith(deps.tx, {
      packageId: 'pkg-1',
      now: '2026-04-27T00:00:00.000Z',
    })
    expect(deps.packageRepo.forceRemove).toHaveBeenCalled()
    expect(deps.repo.insertActionEvent).toHaveBeenCalledWith(
      deps.tx,
      expect.objectContaining({
        action: 'package_removed',
        reasonText: 'Confirmed infringement.',
      }),
    )
  })

  it('restores removed packages and writes an action event', async () => {
    const deps = makeDeps()
    deps.createId.mockReset()
    deps.createId.mockReturnValue('event-1')
    deps.packageRepo.restoreRemoved.mockResolvedValue({
      id: 'pkg-1',
      creatorId: 'creator-1',
      status: 'on_sale',
    })
    const service = createTrustService(deps)

    await service.restorePackage({
      actorUserId: 'admin-1',
      packageId: 'pkg-1',
      reportId: 'report-1',
      reasonText: 'Rights verified.',
    })

    expect(deps.db.transaction).toHaveBeenCalled()
    expect(deps.packageRepo.restoreRemoved).toHaveBeenCalledWith(deps.tx, {
      packageId: 'pkg-1',
      now: '2026-04-27T00:00:00.000Z',
    })
    expect(deps.packageRepo.restoreRemoved).toHaveBeenCalled()
    expect(deps.repo.insertActionEvent).toHaveBeenCalledWith(
      deps.tx,
      expect.objectContaining({
        action: 'package_restored',
        reasonText: 'Rights verified.',
      }),
    )
  })

  it('lists reports with status filter', async () => {
    const deps = makeDeps()
    deps.repo.listReports.mockResolvedValue([{ id: 'report-1', status: 'open' }])
    const service = createTrustService(deps)

    const result = await service.listReports({ status: 'open', limit: 50 })

    expect(deps.repo.listReports).toHaveBeenCalledWith(deps.db, {
      status: 'open',
      limit: 50,
    })
    expect(result).toHaveLength(1)
  })

  it('lists reports without status filter when status is invalid', async () => {
    const deps = makeDeps()
    deps.repo.listReports.mockResolvedValue([])
    const service = createTrustService(deps)

    await service.listReports({ status: 'bogus', limit: 10 })

    expect(deps.repo.listReports).toHaveBeenCalledWith(deps.db, {
      status: undefined,
      limit: 10,
    })
  })

  it('returns report detail', async () => {
    const deps = makeDeps()
    deps.repo.getReportDetail.mockResolvedValue({
      report: { id: 'report-1' },
      package: { id: 'pkg-1' },
      assets: [],
      events: [],
    })
    const service = createTrustService(deps)

    const result = await service.getReportDetail({ reportId: 'report-1' })

    expect(result.report.id).toBe('report-1')
  })

  it('throws NotFound for missing report detail', async () => {
    const deps = makeDeps()
    deps.repo.getReportDetail.mockResolvedValue(undefined)
    const service = createTrustService(deps)

    await expect(service.getReportDetail({ reportId: 'missing' })).rejects.toMatchObject({
      code: Code.NotFound,
    })
  })

  it('marks an open report as reviewing', async () => {
    const deps = makeDeps()
    deps.createId.mockReset()
    deps.createId.mockReturnValue('event-1')
    deps.repo.transitionReport.mockResolvedValue({
      id: 'report-1',
      packageId: 'pkg-1',
      status: 'reviewing',
    })
    const service = createTrustService(deps)

    const result = await service.markReviewing({
      reportId: 'report-1',
      actorUserId: 'admin-1',
      note: 'Investigating.',
    })

    expect(result.status).toBe('reviewing')
    expect(deps.db.transaction).toHaveBeenCalled()
    expect(deps.repo.transitionReport).toHaveBeenCalledWith(
      deps.tx,
      expect.objectContaining({ status: 'reviewing', fromStatuses: ['open'] }),
    )
  })

  it('throws FailedPrecondition if report is not open when marking reviewing', async () => {
    const deps = makeDeps()
    deps.repo.transitionReport.mockResolvedValue(undefined)
    const service = createTrustService(deps)

    await expect(
      service.markReviewing({
        reportId: 'report-1',
        actorUserId: 'admin-1',
        note: '',
      }),
    ).rejects.toMatchObject({ code: Code.FailedPrecondition })
  })

  it('resolves an open or reviewing report', async () => {
    const deps = makeDeps()
    deps.createId.mockReset()
    deps.createId.mockReturnValue('event-1')
    deps.repo.transitionReport.mockResolvedValue({
      id: 'report-1',
      packageId: 'pkg-1',
      status: 'resolved',
    })
    const service = createTrustService(deps)

    const result = await service.resolveReport({
      reportId: 'report-1',
      actorUserId: 'admin-1',
      resolutionText: 'Issue resolved after review.',
    })

    expect(result.status).toBe('resolved')
    expect(deps.db.transaction).toHaveBeenCalled()
    expect(deps.repo.transitionReport).toHaveBeenCalledWith(
      deps.tx,
      expect.objectContaining({
        status: 'resolved',
        fromStatuses: ['open', 'reviewing'],
      }),
    )
  })

  it('dismisses an open or reviewing report', async () => {
    const deps = makeDeps()
    deps.createId.mockReset()
    deps.createId.mockReturnValue('event-1')
    deps.repo.transitionReport.mockResolvedValue({
      id: 'report-1',
      packageId: 'pkg-1',
      status: 'dismissed',
    })
    const service = createTrustService(deps)

    const result = await service.dismissReport({
      reportId: 'report-1',
      actorUserId: 'admin-1',
      resolutionText: 'No violation found.',
    })

    expect(result.status).toBe('dismissed')
    expect(deps.db.transaction).toHaveBeenCalled()
    expect(deps.repo.transitionReport).toHaveBeenCalledWith(
      deps.tx,
      expect.objectContaining({
        status: 'dismissed',
        fromStatuses: ['open', 'reviewing'],
      }),
    )
  })

  it('throws FailedPrecondition if resolve/dismiss transition returns no report', async () => {
    const deps = makeDeps()
    deps.repo.transitionReport.mockResolvedValue(undefined)
    const service = createTrustService(deps)

    await expect(
      service.resolveReport({
        reportId: 'report-1',
        actorUserId: 'admin-1',
        resolutionText: 'Not applicable.',
      }),
    ).rejects.toMatchObject({ code: Code.FailedPrecondition })
  })

  it('holds creator payouts and writes audit event', async () => {
    const deps = makeDeps()
    deps.createId.mockReset()
    deps.createId.mockReturnValue('event-1')
    deps.repo.holdCreatorPayouts.mockResolvedValue({
      id: 'creator-1',
      payoutHoldAt: '2026-04-27T00:00:00.000Z',
    })
    const service = createTrustService(deps)

    await service.holdCreatorPayouts({
      actorUserId: 'admin-1',
      creatorId: 'creator-1',
      reportId: 'report-1',
      packageId: 'pkg-1',
      reasonText: 'Under investigation.',
    })

    expect(deps.db.transaction).toHaveBeenCalled()
    expect(deps.repo.holdCreatorPayouts).toHaveBeenCalledWith(
      deps.tx,
      expect.objectContaining({ creatorId: 'creator-1' }),
    )
    expect(deps.repo.holdCreatorPayouts).toHaveBeenCalled()
    expect(deps.repo.insertActionEvent).toHaveBeenCalledWith(
      deps.tx,
      expect.objectContaining({ action: 'creator_payout_hold_enabled' }),
    )
  })

  it('throws NotFound when holding payouts for missing creator', async () => {
    const deps = makeDeps()
    deps.repo.holdCreatorPayouts.mockResolvedValue(undefined)
    const service = createTrustService(deps)

    await expect(
      service.holdCreatorPayouts({
        actorUserId: 'admin-1',
        creatorId: 'missing',
        reasonText: 'Investigation.',
      }),
    ).rejects.toMatchObject({ code: Code.NotFound })
  })

  it('clears creator payout hold and writes audit event', async () => {
    const deps = makeDeps()
    deps.createId.mockReset()
    deps.createId.mockReturnValue('event-1')
    deps.repo.clearCreatorPayoutHold.mockResolvedValue({
      id: 'creator-1',
      payoutHoldAt: null,
    })
    const service = createTrustService(deps)

    await service.clearCreatorPayoutHold({
      actorUserId: 'admin-1',
      creatorId: 'creator-1',
      reasonText: 'Investigation complete.',
    })

    expect(deps.db.transaction).toHaveBeenCalled()
    expect(deps.repo.clearCreatorPayoutHold).toHaveBeenCalledWith(
      deps.tx,
      expect.objectContaining({ creatorId: 'creator-1' }),
    )
    expect(deps.repo.clearCreatorPayoutHold).toHaveBeenCalled()
    expect(deps.repo.insertActionEvent).toHaveBeenCalledWith(
      deps.tx,
      expect.objectContaining({ action: 'creator_payout_hold_cleared' }),
    )
  })

  it('rejects force remove with empty reason text', async () => {
    const deps = makeDeps()
    const service = createTrustService(deps)

    await expect(
      service.forceRemovePackage({
        actorUserId: 'admin-1',
        packageId: 'pkg-1',
        reasonText: '',
      }),
    ).rejects.toMatchObject({ code: Code.InvalidArgument })
  })

  it('rejects restore with empty reason text', async () => {
    const deps = makeDeps()
    const service = createTrustService(deps)

    await expect(
      service.restorePackage({
        actorUserId: 'admin-1',
        packageId: 'pkg-1',
        reasonText: '',
      }),
    ).rejects.toMatchObject({ code: Code.InvalidArgument })
  })

  it('rejects report with long reason text', async () => {
    const deps = makeDeps()
    deps.packageRepo.findById.mockResolvedValue({
      id: 'pkg-1',
      creatorId: 'creator-1',
      status: 'on_sale',
    })
    const service = createTrustService(deps)

    await expect(
      service.reportStickerPackage({
        packageId: 'pkg-1',
        reporterUserId: 'user-1',
        reasonCategory: 'copyright',
        reasonText: 'x'.repeat(1001),
      }),
    ).rejects.toMatchObject({ code: Code.InvalidArgument })
  })
})
