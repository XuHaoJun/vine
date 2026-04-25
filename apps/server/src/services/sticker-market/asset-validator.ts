import { unzip } from 'fflate'
import type { StickerAssetValidationItem, StickerAssetValidationResult } from './types'

const STATIC_ALLOWED_COUNTS = new Set([8, 16, 24, 32, 40])
const MAX_WIDTH = 370
const MAX_HEIGHT = 320
const MIN_SIDE = 270
const MAX_STATIC_SIZE_BYTES = 500 * 1024

type ValidateInput = {
  zipFile: Uint8Array
  stickerCount: number
}

export async function validateStickerZip(
  input: ValidateInput,
): Promise<StickerAssetValidationResult> {
  const items: StickerAssetValidationItem[] = []

  if (!STATIC_ALLOWED_COUNTS.has(input.stickerCount)) {
    items.push(errorItem('submission.zip', 0, 'invalid_count', 'Unsupported sticker count'))
    return { valid: false, items, files: undefined }
  }

  if (input.zipFile.byteLength === 0) {
    for (let i = 1; i <= input.stickerCount; i += 1) {
      items.push(
        errorItem(
          `png/${String(i).padStart(2, '0')}.png`,
          i,
          'missing_file',
          'Required sticker file is missing',
        ),
      )
    }
    return { valid: false, items, files: undefined }
  }

  let entries: Record<string, Uint8Array>
  try {
    entries = await new Promise((resolve, reject) => {
      unzip(input.zipFile, (err, data) => {
        if (err) reject(err)
        else resolve(data)
      })
    })
  } catch {
    items.push(errorItem('submission.zip', 0, 'zip_invalid', 'ZIP could not be opened'))
    return { valid: false, items, files: undefined }
  }

  const requiredFiles: Array<{ name: string; number: number }> = []
  for (let i = 1; i <= input.stickerCount; i += 1) {
    requiredFiles.push({ name: `png/${String(i).padStart(2, '0')}.png`, number: i })
  }
  requiredFiles.push({ name: 'cover.png', number: 0 })
  requiredFiles.push({ name: 'tab_icon.png', number: 0 })

  let hasError = false
  const stickers: Array<{
    number: number
    fileName: string
    bytes: Uint8Array
    width: number
    height: number
    sizeBytes: number
  }> = []
  let cover: Uint8Array | undefined
  let tabIcon: Uint8Array | undefined

  for (const { name, number } of requiredFiles) {
    const bytes = entries[name]
    if (!bytes) {
      items.push(errorItem(name, number, 'missing_file', 'Required sticker file is missing'))
      hasError = true
      continue
    }

    if (!isPng(bytes)) {
      items.push(errorItem(name, number, 'not_png', 'File is not a valid PNG'))
      hasError = true
      continue
    }

    const { width, height } = extractPngDimensions(bytes)
    const sizeBytes = bytes.byteLength
    const result = validatePngMetadata({ fileName: name, number, width, height, sizeBytes })
    items.push(result)
    if (result.level === 'error') {
      hasError = true
    }

    if (name === 'cover.png') {
      cover = bytes
    } else if (name === 'tab_icon.png') {
      tabIcon = bytes
    } else {
      stickers.push({ number, fileName: name, bytes, width, height, sizeBytes })
    }
  }

  if (hasError) {
    return { valid: false, items, files: undefined }
  }

  stickers.sort((a, b) => a.number - b.number)

  return {
    valid: true,
    items,
    files: {
      cover: cover!,
      tabIcon: tabIcon!,
      stickers,
    },
  }
}

export function validatePngMetadata(input: {
  fileName: string
  number: number
  width: number
  height: number
  sizeBytes: number
}): StickerAssetValidationItem {
  if (input.width % 2 !== 0 || input.height % 2 !== 0) {
    return errorItem(input.fileName, input.number, 'odd_pixels', 'Width and height must be even')
  }
  if (input.width > MAX_WIDTH || input.height > MAX_HEIGHT) {
    return errorItem(input.fileName, input.number, 'too_large', 'Sticker dimensions exceed static limits')
  }
  if (Math.min(input.width, input.height) < MIN_SIDE) {
    return errorItem(input.fileName, input.number, 'too_small', 'Sticker shortest side is too small')
  }
  if (input.sizeBytes > MAX_STATIC_SIZE_BYTES) {
    return {
      fileName: input.fileName,
      number: input.number,
      level: 'warning',
      code: 'file_size_warning',
      message: 'Sticker file size exceeds 500 KB',
      width: input.width,
      height: input.height,
      sizeBytes: input.sizeBytes,
    }
  }
  return {
    fileName: input.fileName,
    number: input.number,
    level: 'ok',
    code: 'ok',
    message: 'OK',
    width: input.width,
    height: input.height,
    sizeBytes: input.sizeBytes,
  }
}

function isPng(bytes: Uint8Array): boolean {
  return (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  )
}

function extractPngDimensions(bytes: Uint8Array): { width: number; height: number } {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const width = view.getUint32(16, false)
  const height = view.getUint32(20, false)
  return { width, height }
}

function errorItem(
  fileName: string,
  number: number,
  code: string,
  message: string,
): StickerAssetValidationItem {
  return {
    fileName,
    number,
    level: 'error',
    code,
    message,
    width: 0,
    height: 0,
    sizeBytes: 0,
  }
}
