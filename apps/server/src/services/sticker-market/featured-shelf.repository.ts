import { and, desc, eq, inArray, sql } from 'drizzle-orm'
import { stickerFeaturedShelf, stickerFeaturedShelfItem } from '@vine/db/schema-private'

export type FeaturedShelfRow = {
  id: string
  slug: string
  title: string
  status: string
  startsAt: string | null
  endsAt: string | null
  createdByUserId: string
  createdAt: string
  updatedAt: string
}

export type FeaturedShelfItemRow = {
  id: string
  shelfId: string
  packageId: string
  position: number
}

export type FeaturedShelfWithItems = FeaturedShelfRow & { items: FeaturedShelfItemRow[] }

export function createFeaturedShelfRepository() {
  return {
    async findActiveShelves(db: any, now: string): Promise<FeaturedShelfWithItems[]> {
      const shelves = await db
        .select()
        .from(stickerFeaturedShelf)
        .where(
          and(
            eq(stickerFeaturedShelf.status, 'published'),
            sql`(${stickerFeaturedShelf.startsAt} IS NULL OR ${stickerFeaturedShelf.startsAt} <= ${now})`,
            sql`(${stickerFeaturedShelf.endsAt} IS NULL OR ${stickerFeaturedShelf.endsAt} >= ${now})`,
          ),
        )
        .orderBy(desc(stickerFeaturedShelf.createdAt))

      if (shelves.length === 0) return []

      const shelfIds = shelves.map((s: any) => s.id)
      const items = await db
        .select()
        .from(stickerFeaturedShelfItem)
        .where(inArray(stickerFeaturedShelfItem.shelfId, shelfIds))
        .orderBy(stickerFeaturedShelfItem.position)

      return shelves.map((shelf: any) => ({
        ...shelf,
        items: items.filter((i: any) => i.shelfId === shelf.id),
      }))
    },

    async findById(db: any, id: string): Promise<FeaturedShelfRow | undefined> {
      const [row] = await db
        .select()
        .from(stickerFeaturedShelf)
        .where(eq(stickerFeaturedShelf.id, id))
        .limit(1)
      return row
    },

    async findAll(db: any): Promise<FeaturedShelfWithItems[]> {
      const shelves = await db
        .select()
        .from(stickerFeaturedShelf)
        .orderBy(desc(stickerFeaturedShelf.createdAt))

      if (shelves.length === 0) return []

      const shelfIds = shelves.map((s: any) => s.id)
      const items = await db
        .select()
        .from(stickerFeaturedShelfItem)
        .where(inArray(stickerFeaturedShelfItem.shelfId, shelfIds))
        .orderBy(stickerFeaturedShelfItem.position)

      return shelves.map((shelf: any) => ({
        ...shelf,
        items: items.filter((i: any) => i.shelfId === shelf.id),
      }))
    },

    async upsert(
      db: any,
      input: {
        id: string
        slug: string
        title: string
        packageIds: string[]
        startsAt: string | null
        endsAt: string | null
        createdByUserId: string
        now: string
      },
    ): Promise<FeaturedShelfRow> {
      return await db.transaction(async (tx: any) => {
        const [existing] = await tx
          .select({ id: stickerFeaturedShelf.id })
          .from(stickerFeaturedShelf)
          .where(eq(stickerFeaturedShelf.id, input.id))
          .limit(1)

        if (existing) {
          await tx
            .update(stickerFeaturedShelf)
            .set({
              slug: input.slug,
              title: input.title,
              startsAt: input.startsAt,
              endsAt: input.endsAt,
              updatedAt: input.now,
            })
            .where(eq(stickerFeaturedShelf.id, input.id))

          await tx
            .delete(stickerFeaturedShelfItem)
            .where(eq(stickerFeaturedShelfItem.shelfId, input.id))
        } else {
          await tx.insert(stickerFeaturedShelf).values({
            id: input.id,
            slug: input.slug,
            title: input.title,
            status: 'draft',
            startsAt: input.startsAt,
            endsAt: input.endsAt,
            createdByUserId: input.createdByUserId,
            createdAt: input.now,
            updatedAt: input.now,
          })
        }

        if (input.packageIds.length > 0) {
          await tx.insert(stickerFeaturedShelfItem).values(
            input.packageIds.map((packageId, i) => ({
              id: `${input.id}_item_${i}`,
              shelfId: input.id,
              packageId,
              position: i,
              createdAt: input.now,
            })),
          )
        }

        const [shelf] = await tx
          .select()
          .from(stickerFeaturedShelf)
          .where(eq(stickerFeaturedShelf.id, input.id))
          .limit(1)
        return shelf
      })
    },

    async publish(db: any, id: string, now: string): Promise<FeaturedShelfRow | undefined> {
      const [row] = await db
        .update(stickerFeaturedShelf)
        .set({ status: 'published', updatedAt: now })
        .where(
          and(
            eq(stickerFeaturedShelf.id, id),
            eq(stickerFeaturedShelf.status, 'draft'),
          ),
        )
        .returning()
      return row
    },

    async archive(db: any, id: string, now: string): Promise<FeaturedShelfRow | undefined> {
      const [row] = await db
        .update(stickerFeaturedShelf)
        .set({ status: 'archived', updatedAt: now })
        .where(eq(stickerFeaturedShelf.id, id))
        .returning()
      return row
    },
  }
}
