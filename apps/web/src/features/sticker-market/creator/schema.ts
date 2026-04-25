import * as v from 'valibot'

export const creatorProfileSchema = v.object({
  displayName: v.pipe(v.string(), v.trim(), v.minLength(1, 'Creator name is required')),
  country: v.pipe(v.string(), v.trim(), v.minLength(2, 'Country is required')),
  bio: v.string(),
})

export const stickerPackageDraftSchema = v.object({
  name: v.pipe(v.string(), v.trim(), v.minLength(1, 'Package name is required')),
  description: v.pipe(v.string(), v.trim(), v.maxLength(100, 'Description is too long')),
  priceMinor: v.pipe(v.number(), v.minValue(1, 'Price is required')),
  stickerCount: v.picklist([8, 16, 24, 32, 40]),
  tagsText: v.string(),
  copyrightText: v.pipe(v.string(), v.trim(), v.minLength(1, 'Copyright text is required')),
  licenseConfirmed: v.pipe(
    v.boolean(),
    v.custom((input) => input === true, 'Original work confirmation is required'),
  ),
  autoPublish: v.boolean(),
})

export type CreatorProfileFormData = v.InferInput<typeof creatorProfileSchema>
export type StickerPackageDraftFormData = v.InferInput<typeof stickerPackageDraftSchema>
