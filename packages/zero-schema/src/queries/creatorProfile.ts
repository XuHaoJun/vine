import { zql } from 'on-zero'
import { creatorProfilePermission } from '../models/creatorProfile'

export const creatorProfileByUserId = (props: { userId: string }) => {
  return zql.creatorProfile
    .where(creatorProfilePermission)
    .where('userId', props.userId)
    .one()
}
