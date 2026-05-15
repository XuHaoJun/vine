export type RichMenuImageValidationInput = {
  contentType: string
  bytes: Uint8Array
  expectedWidth: number
  expectedHeight: number
}

export type RichMenuImageValidationResult =
  | { success: true; extension: 'jpg' | 'png'; width: number; height: number }
  | { success: false; message: string }

const MAX_RICH_MENU_IMAGE_BYTES = 1024 * 1024

function readPngDimensions(bytes: Uint8Array) {
  const signature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]
  if (bytes.length < 24) return null
  for (let i = 0; i < signature.length; i++) {
    if (bytes[i] !== signature[i]) return null
  }
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  return { width: view.getUint32(16), height: view.getUint32(20) }
}

function readJpegDimensions(bytes: Uint8Array) {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return null
  let offset = 2
  while (offset + 4 < bytes.length) {
    if (bytes[offset] !== 0xff) {
      offset++
      continue
    }
    const marker = bytes[offset + 1]
    if (marker === 0x01 || marker === 0xD8 || marker === 0xD9 || (marker >= 0xD0 && marker <= 0xD7)) {
      offset += 2
      continue
    }
    if (offset + 4 >= bytes.length) return null
    const length = (bytes[offset + 2] << 8) + bytes[offset + 3]
    if (length < 2) return null
    if (marker >= 0xc0 && marker <= 0xc3) {
      if (offset + 8 >= bytes.length) return null
      return {
        height: (bytes[offset + 5] << 8) + bytes[offset + 6],
        width: (bytes[offset + 7] << 8) + bytes[offset + 8],
      }
    }
    offset += 2 + length
  }
  return null
}

export function validateRichMenuImageUpload(
  input: RichMenuImageValidationInput,
): RichMenuImageValidationResult {
  const normalizedType = input.contentType.split(';')[0]?.trim().toLowerCase()
  const isPng = normalizedType === 'image/png'
  const isJpeg = normalizedType === 'image/jpeg' || normalizedType === 'image/jpg'
  if (!isPng && !isJpeg) {
    return { success: false, message: 'Uploaded image must be JPEG or PNG' }
  }
  if (input.bytes.length > MAX_RICH_MENU_IMAGE_BYTES) {
    return { success: false, message: 'Uploaded image must be 1 MB or smaller' }
  }
  const dimensions = isPng ? readPngDimensions(input.bytes) : readJpegDimensions(input.bytes)
  if (!dimensions) {
    return { success: false, message: 'Uploaded image dimensions could not be read' }
  }
  if (
    dimensions.width !== input.expectedWidth ||
    dimensions.height !== input.expectedHeight
  ) {
    return {
      success: false,
      message: `Uploaded image must be ${input.expectedWidth}x${input.expectedHeight}`,
    }
  }
  return {
    success: true,
    extension: isPng ? 'png' : 'jpg',
    width: dimensions.width,
    height: dimensions.height,
  }
}
