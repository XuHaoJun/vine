import { Code, ConnectError } from '@connectrpc/connect'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createTrustService } from './trust.service'

function makeDeps() {
  const repo = {
    createReport: vi.fn(),
    insertActionEvent: vi.fn(),
    listReports: vi.fn(),
    getReportDetail: vi.fn(),
    markReportReviewing: vi.fn(),
    resolveReport: vi.fn(),
    dismissReport: vi.fn(),
    holdCreatorPayouts: vi.fn(),
    clearCreatorPayoutHold: vi.fn(),
  }
  const packageRepo = {
    findById: vi.fn(),
    forceRemove: vi.fn(),
    restoreRemoved: vi.fn(),
  }
  const deps = {
    db: {},
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
    expect(deps.repo.createReport).toHaveBeenCalledWith(deps.db, {
      id: 'report-1',
      packageId: 'pkg-1',
      reporterUserId: 'user-1',
      reasonCategory: 'copyright',
      reasonText: 'This looks copied from my artwork.',
      now: '2026-04-27T00:00:00.000Z',
    })
    expect(deps.repo.insertActionEvent).toHaveBeenCalledWith(deps.db, {
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

    expect(deps.packageRepo.forceRemove).toHaveBeenCalled()
    expect(deps.repo.insertActionEvent).toHaveBeenCalledWith(
      deps.db,
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

    expect(deps.packageRepo.restoreRemoved).toHaveBeenCalled()
    expect(deps.repo.insertActionEvent).toHaveBeenCalledWith(
      deps.db,
      expect.objectContaining({
        action: 'package_restored',
        reasonText: 'Rights verified.',
      }),
    )
  })
})
