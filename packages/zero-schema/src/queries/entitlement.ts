import { zql } from 'on-zero'

import { permissions } from '../models/entitlement'

// All entitlements for the current user
export const entitlementsByUserId = (props: { userId: string }) => {
  return zql.entitlement
    .where(permissions)
    .where('userId', props.userId)
    .orderBy('grantedAt', 'desc')
}
