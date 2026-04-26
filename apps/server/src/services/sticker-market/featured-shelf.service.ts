export function createFeaturedShelfService(deps: {
  db: any
  featuredShelfRepo: any
  now: () => Date
  createId: () => string
}) {
  return {
    listShelves() {
      return deps.featuredShelfRepo.findAll(deps.db)
    },

    async upsertShelf(input: {
      id: string
      slug: string
      title: string
      packageIds: string[]
      startsAt: string | null
      endsAt: string | null
      createdByUserId: string
    }) {
      return deps.featuredShelfRepo.upsert(deps.db, {
        ...input,
        now: deps.now().toISOString(),
      })
    },

    async publishShelf(id: string) {
      const shelf = await deps.featuredShelfRepo.publish(
        deps.db,
        id,
        deps.now().toISOString(),
      )
      if (!shelf) throw new Error('shelf not found or not in draft status')
      return shelf
    },

    async archiveShelf(id: string) {
      const shelf = await deps.featuredShelfRepo.archive(
        deps.db,
        id,
        deps.now().toISOString(),
      )
      if (!shelf) throw new Error('shelf not found')
      return shelf
    },
  }
}
