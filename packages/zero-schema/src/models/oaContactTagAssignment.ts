import { number, string, table } from '@rocicorp/zero'
/* eslint-disable @typescript-eslint/no-deprecated -- tx.query is the current Zero mutations API */
import { mutations, run, serverWhere, zql } from 'on-zero'
import type { TableInsertRow } from 'on-zero'

export type OaContactTagAssignment = TableInsertRow<typeof schema>

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

export const schema = table('oaContactTagAssignment')
  .columns({
    id: string(),
    oaId: string(),
    userId: string(),
    tagId: string(),
    createdAt: number(),
  })
  .primaryKey('id')

export const managerOwnedOaContactTagAssignmentPermission = serverWhere(
  'oaContactTagAssignment',
  (eb, auth) => {
    const userId = auth?.id || ''
    return eb.exists('oa', (oaQ) =>
      oaQ.whereExists('provider', (providerQ) => providerQ.where('ownerId', userId)),
    )
  },
)

export const mutate = mutations(schema, managerOwnedOaContactTagAssignmentPermission, {
  assign: async (
    { authData, tx },
    args: {
      id: string
      oaId: string
      userId: string
      tagId: string
      createdAt: number
    },
  ) => {
    if (!authData) throw new Error('Unauthorized')
    await assertManagerOwnsOa(tx as { query?: Record<string, any> }, authData, args.oaId)

    const existing = await readRows(
      tx as { query?: Record<string, any> },
      'oaContactTagAssignment',
      (q: any) =>
        q
          .where('oaId', args.oaId)
          .where('userId', args.userId)
          .where('tagId', args.tagId),
    )

    if (existing.length > 0) return

    await tx.mutate.oaContactTagAssignment.insert({
      id: args.id,
      oaId: args.oaId,
      userId: args.userId,
      tagId: args.tagId,
      createdAt: args.createdAt,
    })
  },
  remove: async (
    { authData, tx },
    args: {
      oaId: string
      userId: string
      tagId: string
    },
  ) => {
    if (!authData) throw new Error('Unauthorized')
    await assertManagerOwnsOa(tx as { query?: Record<string, any> }, authData, args.oaId)

    const existing = await readRows(
      tx as { query?: Record<string, any> },
      'oaContactTagAssignment',
      (q: any) =>
        q
          .where('oaId', args.oaId)
          .where('userId', args.userId)
          .where('tagId', args.tagId),
    )

    if (existing.length > 0) {
      await tx.mutate.oaContactTagAssignment.delete({ id: existing[0].id })
    }
  },
})
