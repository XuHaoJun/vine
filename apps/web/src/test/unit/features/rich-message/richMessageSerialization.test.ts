import { describe, expect, it } from 'vitest'
import {
  fromMessagingApiMessages,
  toMessagingApiMessages,
  summarizeMessagingMessages,
} from '~/features/rich-message/core/serialization'
import { RichMessageStarterKit } from '~/features/rich-message/RichMessageStarterKit'

const extensions = RichMessageStarterKit.configure({
  text: true,
  mediaUrl: true,
  flex: true,
})

describe('rich message serialization', () => {
  it('serializes text and image drafts', () => {
    const messages = toMessagingApiMessages(
      [
        { id: '1', type: 'text', text: 'hello' },
        {
          id: '2',
          type: 'image',
          originalContentUrl: 'https://cdn.example.com/a.jpg',
          previewImageUrl: 'https://cdn.example.com/p.jpg',
        },
      ],
      extensions,
    )

    expect(messages).toEqual([
      { type: 'text', text: 'hello' },
      {
        type: 'image',
        originalContentUrl: 'https://cdn.example.com/a.jpg',
        previewImageUrl: 'https://cdn.example.com/p.jpg',
      },
    ])
  })

  it('summarizes multi-message payloads', () => {
    expect(
      summarizeMessagingMessages([{ type: 'text', text: 'hello' }, { type: 'image' }]),
    ).toBe('2 messages: hello')
  })

  it('deserializes supported messaging API payloads to drafts', () => {
    const drafts = fromMessagingApiMessages(
      [
        { type: 'text', text: 'hello' },
        {
          type: 'image',
          originalContentUrl: 'https://cdn.example.com/a.jpg',
          previewImageUrl: 'https://cdn.example.com/p.jpg',
        },
        {
          type: 'flex',
          altText: 'Promo card',
          contents: { type: 'bubble', body: { type: 'box', layout: 'vertical', contents: [] } },
        },
      ],
      extensions,
    )

    expect(drafts).toMatchObject([
      { type: 'text', text: 'hello' },
      {
        type: 'image',
        originalContentUrl: 'https://cdn.example.com/a.jpg',
        previewImageUrl: 'https://cdn.example.com/p.jpg',
      },
      { type: 'flex', altText: 'Promo card' },
    ])
    expect(drafts.every((draft) => draft.id)).toBe(true)
  })

  it('preserves unsupported messaging API payloads as unknown drafts', () => {
    const drafts = fromMessagingApiMessages(
      [{ type: 'unsupported', value: 1 }, null],
      extensions,
    )

    expect(drafts).toMatchObject([
      { type: 'unsupported', raw: { type: 'unsupported', value: 1 } },
      { type: 'unknown', raw: null },
    ])
  })
})
