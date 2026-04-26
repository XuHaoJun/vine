import { zql } from 'on-zero'
import {
  creatorStickerPackagePermission,
  publicStickerPackagePermission,
} from '../models/stickerPackage'

export const allStickerPackages = (_props: Record<string, never> = {}) => {
  return zql.stickerPackage
    .where(publicStickerPackagePermission)
    .related('creator')
    .orderBy('createdAt', 'asc')
}

export const stickerPackageById = (props: { packageId: string }) => {
  return zql.stickerPackage
    .where(publicStickerPackagePermission)
    .where('id', props.packageId)
    .related('creator')
    .related('assets', (q) => q.orderBy('number', 'asc'))
    .one()
}

export const stickerPackagesByCreatorId = (props: { creatorId: string }) => {
  return zql.stickerPackage
    .where(creatorStickerPackagePermission)
    .where('creatorId', props.creatorId)
    .orderBy('updatedAt', 'desc')
}

export const stickerPackageForCreator = (props: {
  packageId: string
  creatorId: string
}) => {
  return zql.stickerPackage
    .where(creatorStickerPackagePermission)
    .where('id', props.packageId)
    .where('creatorId', props.creatorId)
    .related('assets', (q) => q.orderBy('number', 'asc'))
    .one()
}
