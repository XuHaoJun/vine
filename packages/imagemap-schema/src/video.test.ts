import { describe, expect, it } from 'vitest'
import * as v from 'valibot'
import { ImagemapVideoSchema } from './video'

const area = { x: 0, y: 0, width: 100, height: 100 }

describe('ImagemapVideoSchema', () => {
  it('accepts minimal video (no externalLink)', () => {
    expect(
      v.safeParse(ImagemapVideoSchema, {
        originalContentUrl: 'https://example.com/v.mp4',
        previewImageUrl: 'https://example.com/p.jpg',
        area,
      }).success,
    ).toBe(true)
  })

  it('accepts video with externalLink', () => {
    expect(
      v.safeParse(ImagemapVideoSchema, {
        originalContentUrl: 'https://example.com/v.mp4',
        previewImageUrl: 'https://example.com/p.jpg',
        area,
        externalLink: { linkUri: 'https://example.com/more', label: 'See More' },
      }).success,
    ).toBe(true)
  })

  it('rejects non-HTTPS originalContentUrl', () => {
    expect(
      v.safeParse(ImagemapVideoSchema, {
        originalContentUrl: 'http://example.com/v.mp4',
        previewImageUrl: 'https://example.com/p.jpg',
        area,
      }).success,
    ).toBe(false)
  })

  it('rejects non-HTTPS previewImageUrl', () => {
    expect(
      v.safeParse(ImagemapVideoSchema, {
        originalContentUrl: 'https://example.com/v.mp4',
        previewImageUrl: 'http://example.com/p.jpg',
        area,
      }).success,
    ).toBe(false)
  })

  it('rejects externalLink with label longer than 30 chars', () => {
    expect(
      v.safeParse(ImagemapVideoSchema, {
        originalContentUrl: 'https://example.com/v.mp4',
        previewImageUrl: 'https://example.com/p.jpg',
        area,
        externalLink: { linkUri: 'https://x', label: 'x'.repeat(31) },
      }).success,
    ).toBe(false)
  })

  it('rejects externalLink missing linkUri', () => {
    expect(
      v.safeParse(ImagemapVideoSchema, {
        originalContentUrl: 'https://example.com/v.mp4',
        previewImageUrl: 'https://example.com/p.jpg',
        area,
        externalLink: { label: 'See More' },
      }).success,
    ).toBe(false)
  })

  it('rejects missing area', () => {
    expect(
      v.safeParse(ImagemapVideoSchema, {
        originalContentUrl: 'https://example.com/v.mp4',
        previewImageUrl: 'https://example.com/p.jpg',
      }).success,
    ).toBe(false)
  })
})
