import { describe, expect, it, mock } from 'bun:test'

import { resolveTestRichMenuImageSource } from './ensureSeed'

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
      'https://i.im.ge/en5Toh/Gemini_Generated_Image_puffhnpuffhnpuff-edited.jpg',
    )
    expect(result.mimeType).toBe('image/jpeg')
    expect(result.extension).toBe('jpg')
    expect(Array.from(result.buffer)).toEqual([0xff, 0xd8, 0xff, 0xd9])
  })
})
