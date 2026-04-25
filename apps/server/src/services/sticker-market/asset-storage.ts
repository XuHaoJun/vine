import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'

type StoredSticker = {
  number: number
  driveKey: string
}

export type StoreStickerAssetsInput = {
  uploadRoot: string
  packageId: string
  cover: Uint8Array
  tabIcon: Uint8Array
  stickers: Array<{ number: number; bytes: Uint8Array }>
}

export type StoreStickerAssetsResult = {
  coverDriveKey: string
  tabIconDriveKey: string
  stickers: StoredSticker[]
}

export async function storeStickerAssets(
  input: StoreStickerAssetsInput,
): Promise<StoreStickerAssetsResult> {
  const baseKey = `stickers/${input.packageId}`
  const coverDriveKey = `${baseKey}/cover.png`
  const tabIconDriveKey = `${baseKey}/tab_icon.png`

  await writeUpload(input.uploadRoot, coverDriveKey, input.cover)
  await writeUpload(input.uploadRoot, tabIconDriveKey, input.tabIcon)

  const stickers: StoredSticker[] = []
  for (const sticker of input.stickers) {
    const driveKey = `${baseKey}/${String(sticker.number).padStart(2, '0')}.png`
    await writeUpload(input.uploadRoot, driveKey, sticker.bytes)
    stickers.push({ number: sticker.number, driveKey })
  }

  return { coverDriveKey, tabIconDriveKey, stickers }
}

async function writeUpload(root: string, driveKey: string, bytes: Uint8Array) {
  const path = join(root, driveKey)
  await mkdir(dirname(path), { recursive: true })
  await writeFile(path, bytes)
}
