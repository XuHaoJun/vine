import { serverWhere, zql } from 'on-zero'

const permission = serverWhere('entitlement', (_, auth) => {
  return _.cmp('userId', auth?.id || '')
})

// All entitlements for the current user
export const entitlementsByUserId = (props: { userId: string }) => {
  return zql.entitlement
    .where(permission)
    .where('userId', props.userId)
    .orderBy('grantedAt', 'desc')
}
