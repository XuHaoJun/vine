import { and, desc, eq, sql } from 'drizzle-orm'
import { creatorLaunchNotification, creatorFollow } from '@vine/db/schema-public'

const DEFAULT_PAGE_SIZE = 20

export function createLaunchNotificationService(deps: {
  db: any
  now: () => Date
  createId?: () => string
}) {
  return {
    async notifyFollowers(
      db: any,
      input: { packageId: string; creatorId: string },
    ): Promise<number> {
      const followers = await db
        .select({ userId: creatorFollow.userId })
        .from(creatorFollow)
        .where(eq(creatorFollow.creatorId, input.creatorId))
      if (followers.length === 0) return 0

      const now = deps.now().toISOString()
      const values = followers.map((f: { userId: string }) => ({
        id: deps.createId?.() ?? crypto.randomUUID(),
        recipientUserId: f.userId,
        creatorId: input.creatorId,
        packageId: input.packageId,
        status: 'unread' as const,
        createdAt: now,
      }))

      const result = await db
        .insert(creatorLaunchNotification)
        .values(values)
        .onConflictDoNothing({
          target: [
            creatorLaunchNotification.recipientUserId,
            creatorLaunchNotification.packageId,
          ],
        })
      return (result as any).rowCount ?? values.length
    },

    async listNotifications(input: {
      userId: string
      pageSize: number
      pageToken: string
    }) {
      const pageSize =
        input.pageSize > 0 && input.pageSize <= 100 ? input.pageSize : DEFAULT_PAGE_SIZE

      const conditions = [eq(creatorLaunchNotification.recipientUserId, input.userId)]

      let cursor: { createdAt: string; id: string } | undefined
      if (input.pageToken) {
        try {
          cursor = JSON.parse(Buffer.from(input.pageToken, 'base64url').toString())
        } catch {
          cursor = undefined
        }
      }
      if (cursor) {
        conditions.push(
          sql`(${creatorLaunchNotification.createdAt}, ${creatorLaunchNotification.id}) < (${cursor.createdAt}::timestamp, ${cursor.id})`,
        )
      }

      const rows = await deps.db
        .select({
          id: creatorLaunchNotification.id,
          recipientUserId: creatorLaunchNotification.recipientUserId,
          creatorId: creatorLaunchNotification.creatorId,
          packageId: creatorLaunchNotification.packageId,
          status: creatorLaunchNotification.status,
          createdAt: creatorLaunchNotification.createdAt,
          readAt: creatorLaunchNotification.readAt,
        })
        .from(creatorLaunchNotification)
        .where(and(...conditions))
        .orderBy(
          desc(creatorLaunchNotification.createdAt),
          desc(creatorLaunchNotification.id),
        )
        .limit(pageSize + 1)

      const hasMore = rows.length > pageSize
      const items = rows.slice(0, pageSize)

      let nextPageToken = ''
      if (hasMore && items.length > 0) {
        const last = items[items.length - 1]
        nextPageToken = Buffer.from(
          JSON.stringify({
            createdAt: last.createdAt,
            id: last.id,
          }),
        ).toString('base64url')
      }

      return { items, nextPageToken }
    },

    async markRead(userId: string, notificationId: string) {
      const [row] = await deps.db
        .update(creatorLaunchNotification)
        .set({ status: 'read', readAt: deps.now().toISOString() })
        .where(
          and(
            eq(creatorLaunchNotification.id, notificationId),
            eq(creatorLaunchNotification.recipientUserId, userId),
          ),
        )
        .returning()
      return row ?? undefined
    },
  }
}
