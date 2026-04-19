import { describe, expect, it } from 'vitest'
import * as v from 'valibot'
import { QuickReplySchema } from './quickReply'

describe('QuickReplySchema', () => {
  it('accepts a message-action item', () => {
    const result = v.safeParse(QuickReplySchema, {
      items: [
        {
          type: 'action',
          action: { type: 'message', label: 'Sushi', text: 'Sushi' },
        },
      ],
    })
    expect(result.success).toBe(true)
  })

  it('accepts a uri-action item with imageUrl', () => {
    const result = v.safeParse(QuickReplySchema, {
      items: [
        {
          type: 'action',
          imageUrl: 'https://example.com/icon.png',
          action: { type: 'uri', label: 'Open', uri: 'https://example.com' },
        },
      ],
    })
    expect(result.success).toBe(true)
  })

  it('rejects http (non-HTTPS) imageUrl', () => {
    const result = v.safeParse(QuickReplySchema, {
      items: [
        {
          type: 'action',
          imageUrl: 'http://example.com/icon.png',
          action: { type: 'message', label: 'X', text: 'x' },
        },
      ],
    })
    expect(result.success).toBe(false)
  })

  it('accepts a postback-action item', () => {
    const result = v.safeParse(QuickReplySchema, {
      items: [
        {
          type: 'action',
          action: {
            type: 'postback',
            label: 'Buy',
            data: 'action=buy&id=1',
            displayText: 'Buying #1',
          },
        },
      ],
    })
    expect(result.success).toBe(true)
  })

  it('accepts a datetimepicker-action item', () => {
    const result = v.safeParse(QuickReplySchema, {
      items: [
        {
          type: 'action',
          action: {
            type: 'datetimepicker',
            label: 'Pick',
            data: 'action=pick',
            mode: 'datetime',
          },
        },
      ],
    })
    expect(result.success).toBe(true)
  })

  it('accepts a clipboard-action item', () => {
    const result = v.safeParse(QuickReplySchema, {
      items: [
        {
          type: 'action',
          action: { type: 'clipboard', label: 'Copy', clipboardText: 'hello' },
        },
      ],
    })
    expect(result.success).toBe(true)
  })

  it('rejects camera action (out of v1 scope)', () => {
    const result = v.safeParse(QuickReplySchema, {
      items: [{ type: 'action', action: { type: 'camera', label: 'Camera' } }],
    })
    expect(result.success).toBe(false)
  })

  it('rejects cameraRoll action (out of v1 scope)', () => {
    const result = v.safeParse(QuickReplySchema, {
      items: [{ type: 'action', action: { type: 'cameraRoll', label: 'Roll' } }],
    })
    expect(result.success).toBe(false)
  })

  it('rejects location action (out of v1 scope)', () => {
    const result = v.safeParse(QuickReplySchema, {
      items: [{ type: 'action', action: { type: 'location', label: 'Loc' } }],
    })
    expect(result.success).toBe(false)
  })

  it('rejects richmenuswitch action (LINE-forbidden on quick reply)', () => {
    const result = v.safeParse(QuickReplySchema, {
      items: [
        {
          type: 'action',
          action: {
            type: 'richmenuswitch',
            label: 'Switch',
            richMenuAliasId: 'alias-1',
          },
        },
      ],
    })
    expect(result.success).toBe(false)
  })

  it('rejects empty items array', () => {
    const result = v.safeParse(QuickReplySchema, { items: [] })
    expect(result.success).toBe(false)
  })

  it('rejects more than 13 items', () => {
    const items = Array.from({ length: 14 }, (_, i) => ({
      type: 'action' as const,
      action: { type: 'message' as const, label: `B${i}`, text: `b${i}` },
    }))
    const result = v.safeParse(QuickReplySchema, { items })
    expect(result.success).toBe(false)
  })

  it('accepts exactly 13 items', () => {
    const items = Array.from({ length: 13 }, (_, i) => ({
      type: 'action' as const,
      action: { type: 'message' as const, label: `B${i}`, text: `b${i}` },
    }))
    const result = v.safeParse(QuickReplySchema, { items })
    expect(result.success).toBe(true)
  })

  it('rejects non-action item type', () => {
    const result = v.safeParse(QuickReplySchema, {
      items: [
        {
          type: 'button',
          action: { type: 'message', label: 'X', text: 'x' },
        },
      ],
    })
    expect(result.success).toBe(false)
  })
})
