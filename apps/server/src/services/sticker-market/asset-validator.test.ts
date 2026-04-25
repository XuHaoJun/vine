import { describe, expect, it } from 'vitest'
import { zip, zlibSync } from 'fflate'
import { validateStickerZip } from './asset-validator'

async function makeTestZip(files: Record<string, Uint8Array>): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    zip(files, {}, (err, data) => {
      if (err) reject(err)
      else resolve(data)
    })
  })
}

function makeTestPng(width: number, height: number): Uint8Array {
  const signature = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])

  // IHDR chunk
  const ihdrData = new Uint8Array(13)
  const view = new DataView(ihdrData.buffer)
  view.setUint32(0, width, false)
  view.setUint32(4, height, false)
  ihdrData[8] = 8 // bit depth
  ihdrData[9] = 6 // color type RGBA
  ihdrData[10] = 0 // compression
  ihdrData[11] = 0 // filter
  ihdrData[12] = 0 // interlace

  const ihdrType = new TextEncoder().encode('IHDR')
  const ihdrLen = new Uint8Array(4)
  new DataView(ihdrLen.buffer).setUint32(0, ihdrData.length, false)
  const ihdrCrcBytes = new Uint8Array([0, 0, 0, 0]) // dummy CRC
  const ihdr = new Uint8Array([...ihdrLen, ...ihdrType, ...ihdrData, ...ihdrCrcBytes])

  // IDAT chunk
  const scanlineLength = 1 + width * 4
  const rawData = new Uint8Array(height * scanlineLength)
  for (let y = 0; y < height; y++) {
    rawData[y * scanlineLength] = 0 // filter: None
  }
  const compressed = zlibSync(rawData)
  const idatType = new TextEncoder().encode('IDAT')
  const idatLen = new Uint8Array(4)
  new DataView(idatLen.buffer).setUint32(0, compressed.length, false)
  const idatCrcBytes = new Uint8Array([0, 0, 0, 0]) // dummy CRC
  const idat = new Uint8Array([...idatLen, ...idatType, ...compressed, ...idatCrcBytes])

  // IEND chunk
  const iendType = new TextEncoder().encode('IEND')
  const iendLen = new Uint8Array([0, 0, 0, 0])
  const iendCrcBytes = new Uint8Array([0, 0, 0, 0]) // dummy CRC
  const iend = new Uint8Array([...iendLen, ...iendType, ...iendCrcBytes])

  const result = new Uint8Array(signature.length + ihdr.length + idat.length + iend.length)
  result.set(signature, 0)
  result.set(ihdr, signature.length)
  result.set(idat, signature.length + ihdr.length)
  result.set(iend, signature.length + ihdr.length + idat.length)
  return result
}

describe('validateStickerZip', () => {
  it('rejects unreadable zip bytes', async () => {
    const result = await validateStickerZip({
      zipFile: new Uint8Array([1, 2, 3]),
      stickerCount: 8,
    })

    expect(result.valid).toBe(false)
    expect(result.items.some((item) => item.code === 'zip_invalid')).toBe(true)
  })

  it('reports missing required sticker files', async () => {
    const result = await validateStickerZip({
      zipFile: new Uint8Array([]),
      stickerCount: 8,
    })

    expect(result.valid).toBe(false)
    expect(result.items.some((item) => item.code === 'missing_file')).toBe(true)
  })

  it('validates a proper ZIP with valid PNGs', async () => {
    const files: Record<string, Uint8Array> = {}
    for (let i = 1; i <= 8; i++) {
      files[`png/${String(i).padStart(2, '0')}.png`] = makeTestPng(300, 300)
    }
    files['cover.png'] = makeTestPng(300, 300)
    files['tab_icon.png'] = makeTestPng(300, 300)

    const zipFile = await makeTestZip(files)
    const result = await validateStickerZip({ zipFile, stickerCount: 8 })

    expect(result.valid).toBe(true)
    expect(result.files).toBeDefined()
    expect(result.files!.stickers.length).toBe(8)
    expect(result.files!.cover).toBeDefined()
    expect(result.files!.tabIcon).toBeDefined()
    expect(result.items.every((item) => item.level === 'ok')).toBe(true)
  })

  it('rejects a ZIP with missing files', async () => {
    const files: Record<string, Uint8Array> = {}
    for (let i = 1; i <= 7; i++) {
      files[`png/${String(i).padStart(2, '0')}.png`] = makeTestPng(300, 300)
    }
    // missing png/08.png, cover.png, tab_icon.png

    const zipFile = await makeTestZip(files)
    const result = await validateStickerZip({ zipFile, stickerCount: 8 })

    expect(result.valid).toBe(false)
    expect(result.items.filter((item) => item.code === 'missing_file').length).toBe(3)
  })

  it('rejects a ZIP with odd-dimension PNGs', async () => {
    const files: Record<string, Uint8Array> = {}
    for (let i = 1; i <= 8; i++) {
      files[`png/${String(i).padStart(2, '0')}.png`] = makeTestPng(301, 300)
    }
    files['cover.png'] = makeTestPng(300, 300)
    files['tab_icon.png'] = makeTestPng(300, 300)

    const zipFile = await makeTestZip(files)
    const result = await validateStickerZip({ zipFile, stickerCount: 8 })

    expect(result.valid).toBe(false)
    expect(result.items.some((item) => item.code === 'odd_pixels')).toBe(true)
  })

  it('rejects a ZIP with oversized PNGs', async () => {
    const files: Record<string, Uint8Array> = {}
    for (let i = 1; i <= 8; i++) {
      files[`png/${String(i).padStart(2, '0')}.png`] = makeTestPng(400, 300)
    }
    files['cover.png'] = makeTestPng(300, 300)
    files['tab_icon.png'] = makeTestPng(300, 300)

    const zipFile = await makeTestZip(files)
    const result = await validateStickerZip({ zipFile, stickerCount: 8 })

    expect(result.valid).toBe(false)
    expect(result.items.some((item) => item.code === 'too_large')).toBe(true)
  })
})
