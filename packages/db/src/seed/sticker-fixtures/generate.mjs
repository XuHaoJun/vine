// packages/db/src/seed/sticker-fixtures/generate.mjs
import { deflateSync } from 'zlib'
import { writeFileSync, mkdirSync } from 'fs'
import path from 'path'

function crc32(buf) {
  const table = []
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1)
    table[n] = c >>> 0
  }
  let c = 0xffffffff
  for (let i = 0; i < buf.length; i++) c = (table[(c ^ buf[i]) & 0xff] ^ (c >>> 8)) >>> 0
  const out = Buffer.alloc(4)
  out.writeUInt32BE((c ^ 0xffffffff) >>> 0, 0)
  return out
}

function intBE(n) {
  const b = Buffer.alloc(4)
  b.writeUInt32BE(n, 0)
  return b
}

function makeSolidPng(r, g, b, width = 200, height = 200) {
  const PNG_SIG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])

  // IHDR
  const ihdrData = Buffer.concat([
    Buffer.from('IHDR'),
    intBE(width), intBE(height),
    Buffer.from([0x08, 0x02, 0x00, 0x00, 0x00]),
  ])
  const ihdr = Buffer.concat([intBE(13), ihdrData, crc32(ihdrData)])

  // IDAT
  const rowLen = width * 3
  const raw = Buffer.alloc(height * (rowLen + 1))
  for (let y = 0; y < height; y++) {
    raw[y * (rowLen + 1)] = 0 // filter byte
    for (let x = 0; x < width; x++) {
      const off = y * (rowLen + 1) + 1 + x * 3
      raw[off] = r; raw[off + 1] = g; raw[off + 2] = b
    }
  }
  const compressed = deflateSync(raw)
  const idatData = Buffer.concat([Buffer.from('IDAT'), compressed])
  const idat = Buffer.concat([intBE(compressed.length), idatData, crc32(idatData)])

  // IEND
  const iendData = Buffer.from('IEND')
  const iend = Buffer.concat([intBE(0), iendData, crc32(iendData)])

  return Buffer.concat([PNG_SIG, ihdr, idat, iend])
}

const PACKAGES = [
  { id: 'pkg_cat_01', r: 255, g: 179, b: 71 },   // orange
  { id: 'pkg_dog_01', r: 135, g: 206, b: 235 },  // sky blue
  { id: 'pkg_bun_01', r: 248, g: 180, b: 217 },  // pink
]

const __dirname = path.dirname(new URL(import.meta.url).pathname)

for (const pkg of PACKAGES) {
  const dir = path.join(__dirname, pkg.id)
  mkdirSync(dir, { recursive: true })
  writeFileSync(path.join(dir, 'cover.png'), makeSolidPng(pkg.r, pkg.g, pkg.b, 370, 370))
  writeFileSync(path.join(dir, 'tab.png'), makeSolidPng(pkg.r, pkg.g, pkg.b, 60, 60))
  for (let i = 1; i <= 8; i++) {
    const tint = Math.min(255, pkg.r + i * 4)
    writeFileSync(path.join(dir, `${i}.png`), makeSolidPng(tint, pkg.g, pkg.b, 200, 200))
  }
}
console.log('fixtures generated')
