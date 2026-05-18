import { describe, expect, it } from 'vitest'
import {
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
    expect(summarizeMessagingMessages([{ type: 'text', text: 'hello' }, { type: 'image' }])).toBe(
      '2 messages: hello',
    )
  })
})
