import { number, string, table } from '@rocicorp/zero'
import { serverWhere } from 'on-zero'

import type { TableInsertRow } from 'on-zero'

export type Entitlement = TableInsertRow<typeof schema>

export const schema = table('entitlement')
  .columns({
    id: string(),
    userId: string(),
    packageId: string(),
    grantedByOrderId: string(),
    grantedAt: number(),
  })
  .primaryKey('id')

export const permissions = serverWhere('entitlement', (_, auth) => {
  return _.cmp('userId', auth?.id || '')
})
