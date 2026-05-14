import type { AudienceQueryJson } from '@vine/zero-schema/audience/query'
import { oaAudienceFiltersByOfficialAccountId } from '@vine/zero-schema/queries/oaAudienceFilter'
import { useMemo } from 'react'
import { oaClient } from '~/features/oa/client'
import { useTanMutation } from '~/query'
import { useZeroQuery, zero } from '~/zero/client'

export type AudienceFilterItem = {
  id: string
  name: string
  queryJson: AudienceQueryJson
  createdAt: number
  updatedAt: number
}

export function useManagerOAAudienceFilters(oaId: string | undefined) {
  const [rawFilters] = useZeroQuery(
    oaAudienceFiltersByOfficialAccountId,
    { oaId: oaId ?? '' },
    { enabled: Boolean(oaId) },
  )

  const filters = useMemo<AudienceFilterItem[]>(
    () =>
      (rawFilters ?? []).map((filter) => ({
        id: filter.id,
        name: filter.name,
        queryJson: filter.queryJson,
        createdAt: filter.createdAt,
        updatedAt: filter.updatedAt,
      })),
    [rawFilters],
  )

  const previewAudience = useTanMutation({
    mutationFn: async (queryJson: AudienceQueryJson) => {
      if (!oaId) throw new Error('Missing official account id')
      return oaClient.previewAudienceFilter({
        officialAccountId: oaId,
        queryJson: JSON.stringify(queryJson),
      })
    },
  })

  const createFilter = async (name: string, queryJson: AudienceQueryJson) => {
    if (!oaId) return
    const now = Date.now()
    await zero.mutate.oaAudienceFilter.create({
      id: crypto.randomUUID(),
      oaId,
      name,
      queryJson,
      createdAt: now,
      updatedAt: now,
    })
  }

  const updateFilter = async (
    id: string,
    name: string,
    queryJson: AudienceQueryJson,
  ) => {
    if (!oaId) return
    await zero.mutate.oaAudienceFilter.update({
      id,
      oaId,
      name,
      queryJson,
      updatedAt: Date.now(),
    })
  }

  const deleteFilter = async (id: string) => {
    if (!oaId) return
    await zero.mutate.oaAudienceFilter.deleteFilter({ id, oaId })
  }

  return {
    filters,
    previewAudience,
    createFilter,
    updateFilter,
    deleteFilter,
  }
}
