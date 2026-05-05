import { and, desc, eq } from 'drizzle-orm'
import type { NodePgDatabase } from 'drizzle-orm/node-postgres'
import type { schema } from '@vine/db'
import { miniApp, miniAppOaLink, oaLiffApp } from '@vine/db/schema-login'

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
  }
}

export type { MiniAppServiceDeps }
