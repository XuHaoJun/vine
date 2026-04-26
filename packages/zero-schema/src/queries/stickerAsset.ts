import { zql } from 'on-zero'
import { stickerAssetReadPermission } from '../models/stickerAsset'

export const stickerAssetsByPackageId = (props: { packageId: string }) => {
  return zql.stickerAsset
    .where(stickerAssetReadPermission)
    .where('packageId', props.packageId)
    .orderBy('number', 'asc')
}
