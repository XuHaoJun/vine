import { json, number, string, table } from '@rocicorp/zero'
/* eslint-disable @typescript-eslint/no-deprecated -- tx.query is the current Zero mutations API */
import { mutations, run, serverWhere, zql } from 'on-zero'
import { validateAudienceQuery, type AudienceQueryJson } from '../audience/query'
import type { TableInsertRow } from 'on-zero'

export type OaAudienceFilter = TableInsertRow<typeof schema>

const MAX_FILTERS_PER_OA = 50

async function readRows(
  tx: { query?: Record<string, any> },
  tableName: string,
  build: (query: any) => any,
) {
  const query = tx.query as Record<string, any> | undefined
  const txQuery = query?.[tableName]
  if (txQuery) {
    return build(txQuery).run()
  }

  return run(build((zql as Record<string, any>)[tableName]))
}

async function assertManagerOwnsOa(
  tx: { query?: Record<string, any> },
  authData: { id: string },
  oaId: string,
) {
  const accounts = await readRows(tx, 'officialAccount', (q) => q.where('id', oaId))
  const account = accounts[0]
  if (!account) throw new Error('Unauthorized')

  const providers = await readRows(tx, 'oaProvider', (q) =>
    q.where('id', account.providerId),
  )
  const provider = providers[0]
  if (!provider || provider.ownerId !== authData.id) {
    throw new Error('Unauthorized')
  }
}

async function assertFilterBelongsToOa(
  tx: { query?: Record<string, any> },
  id: string,
  oaId: string,
) {
  const filters = await readRows(tx, 'oaAudienceFilter', (q) => q.where('id', id))
  const filter = filters[0]
  if (!filter || filter.oaId !== oaId) throw new Error('Unauthorized')
}

export const schema = table('oaAudienceFilter')
  .columns({
    id: string(),
    oaId: string(),
    name: string(),
    queryVersion: number(),
    queryJson: json<AudienceQueryJson & Record<string, any>>(),
    createdByManagerId: string(),
    createdAt: number(),
    updatedAt: number(),
  })
  .primaryKey('id')

export const managerOwnedOaAudienceFilterPermission = serverWhere(
  'oaAudienceFilter',
  (eb, auth) => {
    const userId = auth?.id || ''
    return eb.exists('oa', (oaQ) =>
      oaQ.whereExists('provider', (providerQ) => providerQ.where('ownerId', userId)),
    )
  },
)

function cleanName(name: string): string {
  const trimmed = name.trim()
  if (trimmed.length === 0) throw new Error('Filter name is required')
  if (trimmed.length > 64) throw new Error('Filter name too long (max 64)')
  return trimmed
}

function cleanQueryJson(queryJson: AudienceQueryJson): AudienceQueryJson {
  const result = validateAudienceQuery(queryJson)
  if (!result.ok) throw new Error(result.error)
  return queryJson
}

async function assertNoDuplicateName(
  tx: { query?: Record<string, any> },
  oaId: string,
  name: string,
  excludeId?: string,
) {
  const existing = await readRows(tx, 'oaAudienceFilter', (q) =>
    q.where('oaId', oaId).where('name', name),
  )

  for (const filter of existing) {
    if (filter.id !== excludeId) throw new Error('Filter name already exists')
  }
}

async function rejectClientAudienceFilterMutation(): Promise<void> {
  throw new Error('Use audience filter actions')
}

export const mutate = mutations(schema, managerOwnedOaAudienceFilterPermission, {
  insert: rejectClientAudienceFilterMutation,
  upsert: rejectClientAudienceFilterMutation,
  delete: rejectClientAudienceFilterMutation,
  create: async (
    { authData, tx },
    args: {
      id: string
      oaId: string
      name: string
      queryJson: AudienceQueryJson
      createdAt: number
      updatedAt: number
    },
  ) => {
    if (!authData) throw new Error('Unauthorized')
    await assertManagerOwnsOa(tx as { query?: Record<string, any> }, authData, args.oaId)

    const name = cleanName(args.name)
    const queryJson = cleanQueryJson(args.queryJson)
    const existing = await readRows(tx, 'oaAudienceFilter', (q) =>
      q.where('oaId', args.oaId),
    )
    if (existing.length >= MAX_FILTERS_PER_OA) {
      throw new Error(`Cannot create more than ${MAX_FILTERS_PER_OA} audience filters`)
    }
    await assertNoDuplicateName(tx as { query?: Record<string, any> }, args.oaId, name)

    await tx.mutate.oaAudienceFilter.insert({
      id: args.id,
      oaId: args.oaId,
      name,
      queryVersion: 1,
      queryJson,
      createdByManagerId: authData.id,
      createdAt: args.createdAt,
      updatedAt: args.updatedAt,
    })
  },
  update: async (
    { authData, tx },
    args: {
      id: string
      oaId: string
      name: string
      queryJson: AudienceQueryJson
      updatedAt: number
    },
  ) => {
    if (!authData) throw new Error('Unauthorized')
    await assertManagerOwnsOa(tx as { query?: Record<string, any> }, authData, args.oaId)
    await assertFilterBelongsToOa(
      tx as { query?: Record<string, any> },
      args.id,
      args.oaId,
    )

    const name = cleanName(args.name)
    const queryJson = cleanQueryJson(args.queryJson)
    await assertNoDuplicateName(
      tx as { query?: Record<string, any> },
      args.oaId,
      name,
      args.id,
    )

    await tx.mutate.oaAudienceFilter.update({
      id: args.id,
      name,
      queryJson,
      updatedAt: args.updatedAt,
    })
  },
  deleteFilter: async ({ authData, tx }, args: { id: string; oaId: string }) => {
    if (!authData) throw new Error('Unauthorized')
    await assertManagerOwnsOa(tx as { query?: Record<string, any> }, authData, args.oaId)
    await assertFilterBelongsToOa(
      tx as { query?: Record<string, any> },
      args.id,
      args.oaId,
    )

    await tx.mutate.oaAudienceFilter.delete({ id: args.id })
  },
})
