import { string, table } from '@rocicorp/zero'
/* eslint-disable @typescript-eslint/no-deprecated -- tx.query is the current Zero mutations API */
import { mutations, run, serverWhere, zql } from 'on-zero'
import type { TableInsertRow } from 'on-zero'

export type OaContactProfile = TableInsertRow<typeof schema>

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

async function assertOaContactExists(
  tx: { query?: Record<string, any> },
  oaId: string,
  userId: string,
) {
  const friendships = await readRows(tx, 'oaFriendship', (q) =>
    q.where('oaId', oaId).where('userId', userId).where('status', 'friend'),
  )
  if (friendships.length === 0) throw new Error('Contact not found')
}

export const schema = table('oaContactProfile')
  .columns({
    id: string(),
    oaId: string(),
    userId: string(),
    noteText: string(),
    noteUpdatedAt: string().optional(),
    createdAt: string(),
    updatedAt: string(),
  })
  .primaryKey('id')

export const managerOwnedOaContactProfilePermission = serverWhere(
  'oaContactProfile',
  (eb, auth) => {
    const userId = auth?.id || ''
    return eb.exists('oa', (oaQ) =>
      oaQ.whereExists('provider', (providerQ) => providerQ.where('ownerId', userId)),
    )
  },
)

export const mutate = mutations(schema, managerOwnedOaContactProfilePermission, {
  saveNote: async (
    { authData, tx },
    args: {
      oaId: string
      userId: string
      noteText: string
      updatedAt: string
    },
  ) => {
    if (!authData) throw new Error('Unauthorized')

    await assertManagerOwnsOa(tx as { query?: Record<string, any> }, authData, args.oaId)
    await assertOaContactExists(
      tx as { query?: Record<string, any> },
      args.oaId,
      args.userId,
    )

    const trimmed = args.noteText.trim()
    const existing = await readRows(
      tx as { query?: Record<string, any> },
      'oaContactProfile',
      (q: any) => q.where('oaId', args.oaId).where('userId', args.userId),
    )

    if (existing.length > 0) {
      await tx.mutate.oaContactProfile.update({
        id: existing[0].id,
        noteText: trimmed,
        noteUpdatedAt: args.updatedAt,
        updatedAt: args.updatedAt,
      })
    } else {
      await tx.mutate.oaContactProfile.insert({
        id: crypto.randomUUID(),
        oaId: args.oaId,
        userId: args.userId,
        noteText: trimmed,
        noteUpdatedAt: args.updatedAt,
        createdAt: args.updatedAt,
        updatedAt: args.updatedAt,
      })
    }
  },
})
