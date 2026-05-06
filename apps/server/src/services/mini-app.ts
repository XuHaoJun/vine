import { and, desc, eq, ilike, notInArray, or, sql } from 'drizzle-orm'
import type { NodePgDatabase } from 'drizzle-orm/node-postgres'
import type { schema } from '@vine/db'
import { miniApp, miniAppOaLink, miniAppRecent, oaLiffApp } from '@vine/db/schema-login'
import { oaFriendship } from '@vine/db/schema-oa'

type MiniAppServiceDeps = {
  db: NodePgDatabase<typeof schema>
}

export function createMiniAppService(deps: MiniAppServiceDeps) {
  const { db } = deps

  async function createMiniApp(input: {
    providerId: string
    liffAppId: string
    name: string
    iconUrl?: string | null
    description?: string | null
    category?: string | null
  }) {
    const [row] = await db
      .insert(miniApp)
      .values({
        providerId: input.providerId,
        liffAppId: input.liffAppId,
        name: input.name,
        iconUrl: input.iconUrl ?? null,
        description: input.description ?? null,
        category: input.category ?? null,
      })
      .returning()
    return row
  }

  async function getMiniApp(id: string) {
    const [row] = await db.select().from(miniApp).where(eq(miniApp.id, id)).limit(1)
    return row ?? null
  }

  async function getMiniAppByLiffAppId(liffAppId: string) {
    const [row] = await db
      .select()
      .from(miniApp)
      .where(eq(miniApp.liffAppId, liffAppId))
      .limit(1)
    return row ?? null
  }

  async function listMiniApps(providerId: string) {
    return db
      .select()
      .from(miniApp)
      .where(eq(miniApp.providerId, providerId))
      .orderBy(desc(miniApp.createdAt))
  }

  async function updateMiniApp(
    id: string,
    input: {
      name?: string
      iconUrl?: string | null
      description?: string | null
      category?: string | null
    },
  ) {
    const [row] = await db
      .update(miniApp)
      .set({
        ...(input.name !== undefined && { name: input.name }),
        ...(input.iconUrl !== undefined && { iconUrl: input.iconUrl }),
        ...(input.description !== undefined && { description: input.description }),
        ...(input.category !== undefined && { category: input.category }),
        updatedAt: new Date().toISOString(),
      })
      .where(eq(miniApp.id, id))
      .returning()
    return row ?? null
  }

  async function publishMiniApp(id: string) {
    const current = await getMiniApp(id)
    if (!current) return null
    if (!current.iconUrl) {
      throw new Error('iconUrl is required to publish a Mini App')
    }
    const publishedAt = current.publishedAt ?? new Date().toISOString()
    const [row] = await db
      .update(miniApp)
      .set({
        isPublished: true,
        publishedAt,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(miniApp.id, id))
      .returning()
    return row ?? null
  }

  async function unpublishMiniApp(id: string) {
    const [row] = await db
      .update(miniApp)
      .set({ isPublished: false, updatedAt: new Date().toISOString() })
      .where(eq(miniApp.id, id))
      .returning()
    return row ?? null
  }

  async function deleteMiniApp(id: string) {
    await db.delete(miniApp).where(eq(miniApp.id, id))
  }

  async function linkOa(input: { miniAppId: string; oaId: string }) {
    await db
      .insert(miniAppOaLink)
      .values({ miniAppId: input.miniAppId, oaId: input.oaId })
      .onConflictDoNothing()
  }

  async function unlinkOa(input: { miniAppId: string; oaId: string }) {
    await db
      .delete(miniAppOaLink)
      .where(
        and(
          eq(miniAppOaLink.miniAppId, input.miniAppId),
          eq(miniAppOaLink.oaId, input.oaId),
        ),
      )
  }

  async function listLinkedOaIds(miniAppId: string): Promise<string[]> {
    const rows = await db
      .select({ oaId: miniAppOaLink.oaId })
      .from(miniAppOaLink)
      .where(eq(miniAppOaLink.miniAppId, miniAppId))
    return rows.map((r) => r.oaId)
  }

  async function listMiniAppsLinkedToOa(oaId: string) {
    return db
      .select({ miniApp })
      .from(miniAppOaLink)
      .innerJoin(miniApp, eq(miniApp.id, miniAppOaLink.miniAppId))
      .where(eq(miniAppOaLink.oaId, oaId))
      .then((rows) => rows.map((r) => r.miniApp))
  }

  async function getMiniAppByLoginChannelId(loginChannelId: string) {
    const [row] = await db
      .select({ miniApp })
      .from(oaLiffApp)
      .innerJoin(miniApp, eq(miniApp.liffAppId, oaLiffApp.id))
      .where(eq(oaLiffApp.loginChannelId, loginChannelId))
      .limit(1)
    return row?.miniApp ?? null
  }

  async function recordRecent(input: { userId: string; miniAppId: string }) {
    await db
      .insert(miniAppRecent)
      .values({
        userId: input.userId,
        miniAppId: input.miniAppId,
        lastOpenedAt: new Date().toISOString(),
      })
      .onConflictDoUpdate({
        target: [miniAppRecent.userId, miniAppRecent.miniAppId],
        set: { lastOpenedAt: new Date().toISOString() },
      })
  }

  async function listRecent(userId: string, limit = 12) {
    const rows = await db
      .select({ miniApp })
      .from(miniAppRecent)
      .innerJoin(miniApp, eq(miniApp.id, miniAppRecent.miniAppId))
      .where(and(eq(miniAppRecent.userId, userId), eq(miniApp.isPublished, true)))
      .orderBy(desc(miniAppRecent.lastOpenedAt))
      .limit(limit)
    return rows.map((r) => r.miniApp)
  }

  async function listForUserOas(userId: string, excludeMiniAppIds: string[] = []) {
    const rows = await db
      .select({ miniApp })
      .from(miniAppOaLink)
      .innerJoin(miniApp, eq(miniApp.id, miniAppOaLink.miniAppId))
      .innerJoin(oaFriendship, eq(oaFriendship.oaId, miniAppOaLink.oaId))
      .where(
        and(
          eq(oaFriendship.userId, userId),
          eq(oaFriendship.status, 'friend'),
          eq(miniApp.isPublished, true),
          excludeMiniAppIds.length
            ? notInArray(miniApp.id, excludeMiniAppIds)
            : sql`TRUE`,
        ),
      )
    return rows.map((r) => r.miniApp)
  }

  async function listPublished(input: {
    category?: string
    searchQuery?: string
    limit: number
    offset: number
  }) {
    const where = and(
      eq(miniApp.isPublished, true),
      input.category ? eq(miniApp.category, input.category) : sql`TRUE`,
      input.searchQuery
        ? or(
            ilike(miniApp.name, `%${input.searchQuery}%`),
            ilike(miniApp.description, `%${input.searchQuery}%`),
          )
        : sql`TRUE`,
    )
    const items = await db
      .select()
      .from(miniApp)
      .where(where)
      .orderBy(desc(miniApp.publishedAt))
      .limit(input.limit)
      .offset(input.offset)
    const [{ count }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(miniApp)
      .where(where)
    return { items, total: count }
  }

  return {
    createMiniApp,
    getMiniApp,
    getMiniAppByLiffAppId,
    getMiniAppByLoginChannelId,
    listMiniApps,
    updateMiniApp,
    publishMiniApp,
    unpublishMiniApp,
    deleteMiniApp,
    linkOa,
    unlinkOa,
    listLinkedOaIds,
    listMiniAppsLinkedToOa,
    recordRecent,
    listRecent,
    listForUserOas,
    listPublished,
  }
}

export type { MiniAppServiceDeps }
