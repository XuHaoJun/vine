import { describe, expect, it } from 'vitest'
import {
  buildFlexDraftFromJson,
  buildMediaUrlDraft,
} from '~/features/rich-message/dialogs/draftFactories'

describe('rich message dialog draft factories', () => {
  it('builds image drafts from URL form values', () => {
    const result = buildMediaUrlDraft({
      id: 'img-1',
      type: 'image',
      originalContentUrl: 'https://cdn.example.com/image.jpg',
      previewImageUrl: 'https://cdn.example.com/preview.jpg',
    })

    expect(result).toMatchObject({
      id: 'img-1',
      type: 'image',
      originalContentUrl: 'https://cdn.example.com/image.jpg',
      previewImageUrl: 'https://cdn.example.com/preview.jpg',
    })
  })

  it('builds flex drafts from valid Flex JSON', () => {
    const result = buildFlexDraftFromJson({
      id: 'flex-1',
      json: JSON.stringify({
        type: 'flex',
        altText: 'Promo',
        contents: { type: 'bubble' },
      }),
    })

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.draft).toMatchObject({
        id: 'flex-1',
        type: 'flex',
        altText: 'Promo',
        contents: { type: 'bubble' },
      })
    }
  })
})
