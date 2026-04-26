export type StickerPackageStatus =
  | 'draft'
  | 'in_review'
  | 'approved'
  | 'rejected'
  | 'on_sale'
  | 'unlisted'
  | 'removed'

export type ValidationLevel = 'ok' | 'warning' | 'error'

export type StickerAssetValidationItem = {
  fileName: string
  number: number
  level: ValidationLevel
  code: string
  message: string
  width: number
  height: number
  sizeBytes: number
}

export type StickerAssetValidationResult = {
  valid: boolean
  items: StickerAssetValidationItem[]
  files:
    | {
        cover: Uint8Array
        tabIcon: Uint8Array
        stickers: Array<{
          number: number
          fileName: string
          bytes: Uint8Array
          width: number
          height: number
          sizeBytes: number
        }>
      }
    | undefined
}
