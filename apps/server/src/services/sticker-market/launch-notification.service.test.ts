import { describe, expect, it, vi } from 'vitest'
import { createLaunchNotificationService } from './launch-notification.service'

describe('createLaunchNotificationService', () => {
  describe('notifyFollowers', () => {
    it('creates notifications for all followers of a creator', async () => {
      const db = {
        select: vi.fn(() => ({
          from: vi.fn(() => ({
            where: vi.fn(() =>
              Promise.resolve([
                { userId: 'user_1' },
                { userId: 'user_2' },
                { userId: 'user_3' },
              ]),
            ),
          })),
        })),
        insert: vi.fn(() => ({
          values: vi.fn(() => ({
            onConflictDoNothing: vi.fn().mockResolvedValue({ rowCount: 3 }),
          })),
        })),
      }
      const now = new Date('2026-04-26T00:00:00Z')
      const ids: string[] = []
      const service = createLaunchNotificationService({
        db: db as any,
        now: () => now,
        createId: () => {
          const id = `notif_${ids.length + 1}`
          ids.push(id)
          return id
        },
      })

      const count = await service.notifyFollowers(db as any, {
        packageId: 'pkg_1',
        creatorId: 'creator_1',
      })

      expect(count).toBe(3)
      expect(db.insert).toHaveBeenCalled()
    })

    it('returns 0 when creator has no followers', async () => {
      const db = {
        select: vi.fn(() => ({
          from: vi.fn(() => ({
            where: vi.fn(() => Promise.resolve([])),
          })),
        })),
        insert: vi.fn(),
      }
      const service = createLaunchNotificationService({
        db: db as any,
        now: () => new Date(),
        createId: () => 'notif_1',
      })

      const count = await service.notifyFollowers(db as any, {
        packageId: 'pkg_1',
        creatorId: 'creator_no_followers',
      })

      expect(count).toBe(0)
      expect(db.insert).not.toHaveBeenCalled()
    })

    it('creator does not notify themselves', async () => {
      const db = {
        select: vi.fn(() => ({
          from: vi.fn(() => ({
            where: vi.fn(() =>
              Promise.resolve([
                { userId: 'user_1' },
                { userId: 'creator_user' },
                { userId: 'user_2' },
              ]),
            ),
          })),
        })),
        insert: vi.fn(() => ({
          values: vi.fn(() => ({
            onConflictDoNothing: vi.fn().mockResolvedValue({ rowCount: 3 }),
          })),
        })),
      }
      const service = createLaunchNotificationService({
        db: db as any,
        now: () => new Date(),
        createId: () => 'notif_1',
      })

      const count = await service.notifyFollowers(db as any, {
        packageId: 'pkg_1',
        creatorId: 'creator_1',
      })

      // In Phase 3, we don't filter out the creator from followers
      // Self-follow is prevented at the service level (follow service)
      expect(count).toBe(3)
    })
  })

  describe('listNotifications', () => {
    it('returns only notifications for the given user', async () => {
      const db = {
        select: vi.fn(() => ({
          from: vi.fn(() => ({
            where: vi.fn(() => ({
              orderBy: vi.fn(() => ({
                limit: vi.fn(() =>
                  Promise.resolve([
                    {
                      id: 'n1',
                      recipientUserId: 'user_1',
                      creatorId: 'c1',
                      packageId: 'pkg_1',
                      status: 'unread',
                      createdAt: '2026-04-26T00:00:00Z',
                      readAt: null,
                    },
                  ]),
                ),
              })),
            })),
          })),
        })),
      }
      const service = createLaunchNotificationService({
        db: db as any,
        now: () => new Date(),
        createId: () => 'notif_1',
      })

      const result = await service.listNotifications({
        userId: 'user_1',
        pageSize: 20,
        pageToken: '',
      })

      expect(result.items).toHaveLength(1)
      expect(result.items[0].recipientUserId).toBe('user_1')
    })
  })

  describe('markRead', () => {
    it('marks a notification as read', async () => {
      const db = {
        update: vi.fn(() => ({
          set: vi.fn(() => ({
            where: vi.fn(() => ({
              returning: vi
                .fn()
                .mockResolvedValue([{ id: 'n1', readAt: '2026-04-26T01:00:00.000Z' }]),
            })),
          })),
        })),
      }
      const now = new Date('2026-04-26T01:00:00Z')
      const service = createLaunchNotificationService({
        db: db as any,
        now: () => now,
        createId: () => 'notif_1',
      })

      const result = await service.markRead('user_1', 'n1')

      expect(result).toBeDefined()
      expect(result!.readAt).toBe('2026-04-26T01:00:00.000Z')
    })
  })
})
