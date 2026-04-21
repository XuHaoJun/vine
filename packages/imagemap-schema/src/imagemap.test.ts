import { describe, expect, it } from 'vitest'
import * as v from 'valibot'
import { ImagemapMessageSchema } from './imagemap'

const validBase = {
  type: 'imagemap' as const,
  baseUrl: 'https://example.com/bot/images/rm001',
  altText: 'alt',
  baseSize: { width: 1040, height: 1040 },
  actions: [
    {
      type: 'uri' as const,
      linkUri: 'https://x',
      area: { x: 0, y: 0, width: 100, height: 100 },
    },
  ],
}

describe('ImagemapMessageSchema', () => {
  it('accepts minimal valid imagemap', () => {
    expect(v.safeParse(ImagemapMessageSchema, validBase).success).toBe(true)
  })

  it('accepts imagemap with video overlay', () => {
    const msg = {
      ...validBase,
      video: {
        originalContentUrl: 'https://example.com/v.mp4',
        previewImageUrl: 'https://example.com/p.jpg',
        area: { x: 0, y: 0, width: 1040, height: 585 },
        externalLink: { linkUri: 'https://more', label: 'See More' },
      },
    }
    expect(v.safeParse(ImagemapMessageSchema, msg).success).toBe(true)
  })

  it('rejects type other than "imagemap"', () => {
    expect(
      v.safeParse(ImagemapMessageSchema, { ...validBase, type: 'text' }).success,
    ).toBe(false)
  })

  it('rejects baseUrl with .jpg extension', () => {
    expect(
      v.safeParse(ImagemapMessageSchema, {
        ...validBase,
        baseUrl: 'https://example.com/a/b.jpg',
      }).success,
    ).toBe(false)
  })

  it('rejects baseUrl with .png extension', () => {
    expect(
      v.safeParse(ImagemapMessageSchema, {
        ...validBase,
        baseUrl: 'https://example.com/a/b.png',
      }).success,
    ).toBe(false)
  })

  it('rejects non-HTTPS baseUrl', () => {
    expect(
      v.safeParse(ImagemapMessageSchema, {
        ...validBase,
        baseUrl: 'http://example.com/a',
      }).success,
    ).toBe(false)
  })

  it('rejects baseSize.width != 1040', () => {
    expect(
      v.safeParse(ImagemapMessageSchema, {
        ...validBase,
        baseSize: { width: 1000, height: 1040 },
      }).success,
    ).toBe(false)
  })

  it('rejects empty actions array', () => {
    expect(
      v.safeParse(ImagemapMessageSchema, { ...validBase, actions: [] }).success,
    ).toBe(false)
  })

  it('rejects more than 50 actions', () => {
    const actions = Array.from({ length: 51 }, (_, i) => ({
      type: 'uri' as const,
      linkUri: 'https://x',
      area: { x: i, y: 0, width: 1, height: 1 },
    }))
    expect(v.safeParse(ImagemapMessageSchema, { ...validBase, actions }).success).toBe(
      false,
    )
  })

  it('rejects altText > 1500 chars', () => {
    expect(
      v.safeParse(ImagemapMessageSchema, { ...validBase, altText: 'x'.repeat(1501) })
        .success,
    ).toBe(false)
  })

  it('rejects empty altText', () => {
    expect(
      v.safeParse(ImagemapMessageSchema, { ...validBase, altText: '' }).success,
    ).toBe(false)
  })

  it('rejects action area that overflows baseSize width', () => {
    expect(
      v.safeParse(ImagemapMessageSchema, {
        ...validBase,
        actions: [
          {
            type: 'uri',
            linkUri: 'https://x',
            area: { x: 500, y: 0, width: 600, height: 10 },
          },
        ],
      }).success,
    ).toBe(false)
  })

  it('rejects action area that overflows baseSize height', () => {
    expect(
      v.safeParse(ImagemapMessageSchema, {
        ...validBase,
        baseSize: { width: 1040, height: 500 },
        actions: [
          {
            type: 'uri',
            linkUri: 'https://x',
            area: { x: 0, y: 100, width: 10, height: 500 },
          },
        ],
      }).success,
    ).toBe(false)
  })

  it('rejects video area that overflows baseSize', () => {
    expect(
      v.safeParse(ImagemapMessageSchema, {
        ...validBase,
        video: {
          originalContentUrl: 'https://x/v.mp4',
          previewImageUrl: 'https://x/p.jpg',
          area: { x: 0, y: 0, width: 2000, height: 100 },
        },
      }).success,
    ).toBe(false)
  })
})
