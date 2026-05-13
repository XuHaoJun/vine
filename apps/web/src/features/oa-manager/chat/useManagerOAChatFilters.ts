import { oaChatFiltersByOfficialAccountId } from '@vine/zero-schema/queries/oaChatFilter'
import { oaContactTagsByOfficialAccountId } from '@vine/zero-schema/queries/oaContactTag'
import { useMemo } from 'react'
import { useZeroQuery, zero } from '~/zero/client'

export type ChatFilterItem = {
  id: string
  name: string
  matchMode: 'all' | 'any'
  tagIds: string[]
  sortOrder: number
}

function parseTagIds(raw: string): string[] {
  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export function useManagerOAChatFilters(oaId: string | undefined) {
  const [rawFilters] = useZeroQuery(
    oaChatFiltersByOfficialAccountId,
    { oaId: oaId ?? '' },
    { enabled: Boolean(oaId) },
  )

  const [rawTags] = useZeroQuery(
    oaContactTagsByOfficialAccountId,
    { oaId: oaId ?? '' },
    { enabled: Boolean(oaId) },
  )

  const filters = useMemo<ChatFilterItem[]>(
    () =>
      (rawFilters ?? []).map((f) => ({
        id: f.id,
        name: f.name,
        matchMode: f.matchMode as 'all' | 'any',
        tagIds: parseTagIds(f.tagIds),
        sortOrder: f.sortOrder,
      })),
    [rawFilters],
  )

  const allTags = useMemo(
    () => (rawTags ?? []).map((t) => ({ id: t.id, name: t.name, color: t.color })),
    [rawTags],
  )

  const createFilter = async (
    name: string,
    matchMode: 'all' | 'any',
    tagIds: string[],
  ) => {
    if (!oaId) return
    const id = crypto.randomUUID()
    const now = Date.now()
    const sortOrder = filters.length
    await zero.mutate.oaChatFilter.create({
      id,
      oaId,
      name,
      matchMode,
      tagIds: JSON.stringify(tagIds),
      sortOrder,
      createdAt: now,
      updatedAt: now,
    })
  }

  const updateFilter = async (
    id: string,
    name: string,
    matchMode: 'all' | 'any',
    tagIds: string[],
    sortOrder: number,
  ) => {
    if (!oaId) return
    await zero.mutate.oaChatFilter.update({
      id,
      oaId,
      name,
      matchMode,
      tagIds: JSON.stringify(tagIds),
      sortOrder,
      updatedAt: Date.now(),
    })
  }

  const deleteFilter = async (id: string) => {
    if (!oaId) return
    await zero.mutate.oaChatFilter.deleteFilter({ id, oaId })
  }

  return { filters, allTags, createFilter, updateFilter, deleteFilter }
}
