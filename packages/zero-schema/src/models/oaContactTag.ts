import { number, string, table } from '@rocicorp/zero'
/* eslint-disable @typescript-eslint/no-deprecated -- tx.query is the current Zero mutations API */
import { mutations, run, serverWhere, zql } from 'on-zero'
import type { TableInsertRow } from 'on-zero'

export type OaContactTag = TableInsertRow<typeof schema>

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

export const schema = table('oaContactTag')
  .columns({
    id: string(),
    oaId: string(),
    name: string(),
    color: string().optional(),
    createdAt: number(),
    updatedAt: number(),
  })
  .primaryKey('id')

export const managerOwnedOaContactTagPermission = serverWhere(
  'oaContactTag',
  (eb, auth) => {
    const userId = auth?.id || ''
    return eb.exists('oa', (oaQ) =>
      oaQ.whereExists('provider', (providerQ) => providerQ.where('ownerId', userId)),
    )
  },
)

function cleanName(name: string): string {
  const trimmed = name.trim()
  if (trimmed.length === 0) throw new Error('Tag name is required')
  if (trimmed.length > 32) throw new Error('Tag name too long (max 32)')
  return trimmed
}

async function assertNoDuplicateName(
  tx: { query?: Record<string, any> },
  oaId: string,
  name: string,
  excludeId?: string,
) {
  const existing = await readRows(tx, 'oaContactTag', (q) =>
    q.where('oaId', oaId).where('name', name),
  )

  for (const row of existing) {
    if (row.id !== excludeId) throw new Error('Tag name already exists')
  }
}

export const mutate = mutations(schema, managerOwnedOaContactTagPermission, {
  create: async (
    { authData, tx },
    args: {
      id: string
      oaId: string
      name: string
      color?: string
      createdAt: number
      updatedAt: number
    },
  ) => {
    if (!authData) throw new Error('Unauthorized')
    await assertManagerOwnsOa(tx as { query?: Record<string, any> }, authData, args.oaId)

    const name = cleanName(args.name)
    await assertNoDuplicateName(tx as { query?: Record<string, any> }, args.oaId, name)

    await tx.mutate.oaContactTag.insert({
      id: args.id,
      oaId: args.oaId,
      name,
      color: args.color,
      createdAt: args.createdAt,
      updatedAt: args.updatedAt,
    })
  },
  rename: async (
    { authData, tx },
    args: {
      id: string
      oaId: string
      name: string
      updatedAt: number
    },
  ) => {
    if (!authData) throw new Error('Unauthorized')
    await assertManagerOwnsOa(tx as { query?: Record<string, any> }, authData, args.oaId)

    const name = cleanName(args.name)
    await assertNoDuplicateName(
      tx as { query?: Record<string, any> },
      args.oaId,
      name,
      args.id,
    )

    await tx.mutate.oaContactTag.update({
      id: args.id,
      name,
      updatedAt: args.updatedAt,
    })
  },
  deleteTag: async ({ authData, tx }, args: { id: string; oaId: string }) => {
    if (!authData) throw new Error('Unauthorized')
    await assertManagerOwnsOa(tx as { query?: Record<string, any> }, authData, args.oaId)

    await tx.mutate.oaContactTag.delete({ id: args.id })
  },
})
