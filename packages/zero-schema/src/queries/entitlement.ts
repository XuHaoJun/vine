import { zql } from 'on-zero'

import { entitlementReadPermission } from '../models/entitlement'

// All entitlements for the current user
export const entitlementsByUserId = (props: { userId: string }) => {
  return zql.entitlement
    .where(entitlementReadPermission)
    .where('userId', props.userId)
    .orderBy('grantedAt', 'desc')
}
