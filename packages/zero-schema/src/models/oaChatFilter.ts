import { number, string, table } from '@rocicorp/zero'
/* eslint-disable @typescript-eslint/no-deprecated -- tx.query is the current Zero mutations API */
import { mutations, run, serverWhere, zql } from 'on-zero'
import type { TableInsertRow } from 'on-zero'

export type OaChatFilter = TableInsertRow<typeof schema>

const MAX_FILTERS_PER_OA = 20

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

export const schema = table('oaChatFilter')
  .columns({
    id: string(),
    oaId: string(),
    name: string(),
    matchMode: string(),
    tagIds: string(),
    sortOrder: number(),
    createdAt: number(),
    updatedAt: number(),
  })
  .primaryKey('id')

export const managerOwnedOaChatFilterPermission = serverWhere(
  'oaChatFilter',
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

function validateMatchMode(mode: string): 'all' | 'any' {
  if (mode !== 'all' && mode !== 'any')
    throw new Error('matchMode must be "all" or "any"')
  return mode
}

function validateTagIds(tagIds: string): string[] {
  let parsed: unknown
  try {
    parsed = JSON.parse(tagIds)
  } catch {
    throw new Error('tagIds must be a JSON array')
  }
  if (!Array.isArray(parsed)) throw new Error('tagIds must be a JSON array')
  if (!parsed.every((id) => typeof id === 'string')) {
    throw new Error('tagIds must contain strings')
  }
  return parsed
}

export const mutate = mutations(schema, managerOwnedOaChatFilterPermission, {
  create: async (
    { authData, tx },
    args: {
      id: string
      oaId: string
      name: string
      matchMode: string
      tagIds: string
      sortOrder: number
      createdAt: number
      updatedAt: number
    },
  ) => {
    if (!authData) throw new Error('Unauthorized')
    await assertManagerOwnsOa(tx as { query?: Record<string, any> }, authData, args.oaId)

    const name = cleanName(args.name)
    const matchMode = validateMatchMode(args.matchMode)
    validateTagIds(args.tagIds)

    const existing = await readRows(tx, 'oaChatFilter', (q) => q.where('oaId', args.oaId))
    if (existing.length >= MAX_FILTERS_PER_OA) {
      throw new Error(`Cannot create more than ${MAX_FILTERS_PER_OA} filters`)
    }

    await tx.mutate.oaChatFilter.insert({
      id: args.id,
      oaId: args.oaId,
      name,
      matchMode,
      tagIds: args.tagIds,
      sortOrder: args.sortOrder,
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
      matchMode: string
      tagIds: string
      sortOrder: number
      updatedAt: number
    },
  ) => {
    if (!authData) throw new Error('Unauthorized')
    await assertManagerOwnsOa(tx as { query?: Record<string, any> }, authData, args.oaId)

    const name = cleanName(args.name)
    const matchMode = validateMatchMode(args.matchMode)
    validateTagIds(args.tagIds)

    await tx.mutate.oaChatFilter.update({
      id: args.id,
      name,
      matchMode,
      tagIds: args.tagIds,
      sortOrder: args.sortOrder,
      updatedAt: args.updatedAt,
    })
  },
  deleteFilter: async ({ authData, tx }, args: { id: string; oaId: string }) => {
    if (!authData) throw new Error('Unauthorized')
    await assertManagerOwnsOa(tx as { query?: Record<string, any> }, authData, args.oaId)

    await tx.mutate.oaChatFilter.delete({ id: args.id })
  },
})
