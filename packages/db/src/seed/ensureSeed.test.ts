import { describe, expect, it, mock } from 'bun:test'

import { mkdtempSync, mkdirSync, rmSync } from 'fs'
import os from 'os'
import path from 'path'

import { resolveStickerFixturesDir, resolveTestRichMenuImageSource } from './ensureSeed'

describe('resolveTestRichMenuImageSource', () => {
  it('downloads the configured rich menu image and keeps jpeg metadata', async () => {
    const imageBytes = new Uint8Array([0xff, 0xd8, 0xff, 0xd9])
    let requestedUrl: string | null = null
    const fetchMock = mock((input: string | URL | Request) => {
      requestedUrl = typeof input === 'string' ? input : input.toString()
      return Promise.resolve(
        new Response(imageBytes, {
          status: 200,
          headers: {
            'content-type': 'image/jpeg',
          },
        }),
      )
    })

    const result = await resolveTestRichMenuImageSource(
      fetchMock as unknown as typeof fetch,
    )

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(requestedUrl).toBe(
      'https://img2.pixhost.to/images/7292/716433745_gemini_generated_image_puffhnpuffhnpuff-edited.jpg',
    )
    expect(result.mimeType).toBe('image/jpeg')
    expect(result.extension).toBe('jpg')
    expect(Array.from(result.buffer)).toEqual([0xff, 0xd8, 0xff, 0xd9])
  })

  it('falls back to the repo sticker fixtures when bundled output has no local assets', () => {
    const tempDir = mkdtempSync(path.join(os.tmpdir(), 'vine-seed-fixtures-'))
    const repoFixturesDir = path.join(tempDir, 'packages/db/src/seed/sticker-fixtures')

    mkdirSync(repoFixturesDir, { recursive: true })

    try {
      const result = resolveStickerFixturesDir(
        path.join(tempDir, 'apps/server/dist'),
        path.join(tempDir, 'apps/server'),
      )

      expect(result).toBe(repoFixturesDir)
    } finally {
      rmSync(tempDir, { recursive: true, force: true })
    }
  })
})
