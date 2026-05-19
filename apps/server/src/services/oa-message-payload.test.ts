import { describe, expect, it } from 'vitest'
import {
  normalizeMessagingApiMessages,
  summarizeMessagingMessages,
} from './oa-message-payload'

const flex = {
  type: 'flex',
  altText: 'Promo card',
  contents: {
    type: 'bubble',
    body: {
      type: 'box',
      layout: 'vertical',
      contents: [{ type: 'text', text: 'Sale' }],
    },
  },
}

describe('oa message payload utility', () => {
  it('normalizes text, media, and flex payloads', () => {
    const messages = normalizeMessagingApiMessages([
      { type: 'text', text: 'hello' },
      {
        type: 'image',
        originalContentUrl: 'https://cdn.example.com/a.jpg',
        previewImageUrl: 'https://cdn.example.com/p.jpg',
      },
      flex,
    ])

    expect(messages).toHaveLength(3)
    expect(messages[0]).toEqual({ type: 'text', text: 'hello', metadata: null })
    expect(messages[1].type).toBe('image')
    expect(messages[1].metadata).toContain('originalContentUrl')
    expect(messages[2].type).toBe('flex')
    expect(messages[2].metadata).toContain('Promo card')
  })

  it('rejects unsupported template messages', () => {
    expect(() =>
      normalizeMessagingApiMessages([{ type: 'template', altText: 'No' }]),
    ).toThrow('Unsupported message type: "template"')
  })

  it('keeps sticker and location supported for Messaging API compatibility', () => {
    const messages = normalizeMessagingApiMessages([
      { type: 'sticker', packageId: '1', stickerId: '100' },
      { type: 'location', title: 'Tokyo', latitude: 35.6762, longitude: 139.6503 },
    ])

    expect(messages).toEqual([
      {
        type: 'sticker',
        text: null,
        metadata: JSON.stringify({ packageId: '1', stickerId: '100' }),
      },
      {
        type: 'location',
        text: null,
        metadata: JSON.stringify({
          title: 'Tokyo',
          latitude: 35.6762,
          longitude: 139.6503,
        }),
      },
    ])
  })

  it('summarizes multi-message rich payloads', () => {
    expect(
      summarizeMessagingMessages([
        { type: 'text', text: 'hello world' },
        flex,
        {
          type: 'audio',
          originalContentUrl: 'https://cdn.example.com/a.m4a',
          duration: 1200,
        },
      ]),
    ).toBe('3 messages: hello world')
  })
})
