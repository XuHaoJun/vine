import { zql } from 'on-zero'

// All sticker packages (public catalog, no permission filter)
export const allStickerPackages = (_props: Record<string, never> = {}) => {
  return zql.stickerPackage.orderBy('createdAt', 'asc')
}

// Single sticker package by id
export const stickerPackageById = (props: { packageId: string }) => {
  return zql.stickerPackage.where('id', props.packageId).one()
}
