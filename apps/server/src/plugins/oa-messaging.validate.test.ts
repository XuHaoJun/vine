import { describe, expect, it } from 'vitest'
import { validateMessage } from './oa-messaging'

describe('validateMessage', () => {
  describe('text messages', () => {
    it('accepts valid text message', () => {
      const result = validateMessage({ type: 'text', text: 'Hello' })
      expect(result.valid).toBe(true)
      if (result.valid) {
        expect(result.type).toBe('text')
        expect(result.text).toBe('Hello')
        expect(result.metadata).toBeNull()
      }
    })

    it('rejects text without text field', () => {
      const result = validateMessage({ type: 'text' })
      expect(result.valid).toBe(false)
      if (!result.valid) {
        expect(result.error).toContain('text')
      }
    })

    it('rejects text with non-string text field', () => {
      const result = validateMessage({ type: 'text', text: 123 })
      expect(result.valid).toBe(false)
    })

    it('rejects text exceeding 5000 characters', () => {
      const longText = 'a'.repeat(5001)
      const result = validateMessage({ type: 'text', text: longText })
      expect(result.valid).toBe(false)
      if (!result.valid) {
        expect(result.error).toContain('5000')
      }
    })

    it('accepts text at exactly 5000 characters', () => {
      const maxText = 'a'.repeat(5000)
      const result = validateMessage({ type: 'text', text: maxText })
      expect(result.valid).toBe(true)
    })

    it('accepts empty string text', () => {
      const result = validateMessage({ type: 'text', text: '' })
      expect(result.valid).toBe(true)
    })
  })

  describe('flex messages', () => {
    it('accepts valid flex message', () => {
      const result = validateMessage({
        type: 'flex',
        altText: 'Hello',
        contents: {
          type: 'bubble',
          body: {
            type: 'box',
            layout: 'vertical',
            contents: [{ type: 'text', text: 'Hi' }],
          },
        },
      })
      expect(result.valid).toBe(true)
      if (result.valid) {
        expect(result.type).toBe('flex')
        expect(result.text).toBeNull()
        expect(result.metadata).toBeDefined()
      }
    })

    it('rejects flex with missing altText', () => {
      const result = validateMessage({
        type: 'flex',
        contents: {
          type: 'bubble',
          body: { type: 'box', layout: 'vertical', contents: [] },
        },
      })
      expect(result.valid).toBe(false)
    })

    it('rejects flex with invalid contents', () => {
      const result = validateMessage({
        type: 'flex',
        altText: 'test',
        contents: { type: 'box', layout: 'vertical', contents: [] },
      })
      expect(result.valid).toBe(false)
    })

    it('rejects flex with invalid body layout', () => {
      const result = validateMessage({
        type: 'flex',
        altText: 'test',
        contents: {
          type: 'bubble',
          body: { type: 'box', layout: 'sideways', contents: [] },
        },
      })
      expect(result.valid).toBe(false)
    })

    it('accepts flex carousel', () => {
      const result = validateMessage({
        type: 'flex',
        altText: 'carousel',
        contents: {
          type: 'carousel',
          contents: [
            { type: 'bubble', body: { type: 'box', layout: 'vertical', contents: [] } },
          ],
        },
      })
      expect(result.valid).toBe(true)
    })

    it('stores validated flex JSON as metadata', () => {
      const flexMsg = {
        type: 'flex',
        altText: 'test',
        contents: {
          type: 'bubble',
          body: {
            type: 'box',
            layout: 'vertical',
            contents: [{ type: 'text', text: 'Hi', margin: '12px' }],
          },
        },
      }
      const result = validateMessage(flexMsg)
      expect(result.valid).toBe(true)
      if (result.valid) {
        const parsed = JSON.parse(result.metadata!)
        expect(parsed.type).toBe('flex')
        expect(parsed.contents.body.contents[0].margin).toBe('12px')
      }
    })
  })

  describe('other message types', () => {
    it('accepts image message', () => {
      const result = validateMessage({
        type: 'image',
        originalContentUrl: 'https://example.com/img.png',
        previewImageUrl: 'https://example.com/preview.png',
      })
      expect(result.valid).toBe(true)
      if (result.valid) {
        expect(result.type).toBe('image')
      }
    })

    it('accepts sticker message', () => {
      const result = validateMessage({ type: 'sticker', stickerId: '1', packageId: '1' })
      expect(result.valid).toBe(true)
    })

    it('accepts location message', () => {
      const result = validateMessage({
        type: 'location',
        title: 'Tokyo',
        latitude: 35.6762,
        longitude: 139.6503,
      })
      expect(result.valid).toBe(true)
    })

    it('accepts audio message', () => {
      const result = validateMessage({
        type: 'audio',
        originalContentUrl: 'https://example.com/audio.m4a',
        duration: 60000,
      })
      expect(result.valid).toBe(true)
    })

    it('accepts video message', () => {
      const result = validateMessage({
        type: 'video',
        originalContentUrl: 'https://example.com/video.mp4',
        previewImageUrl: 'https://example.com/preview.png',
      })
      expect(result.valid).toBe(true)
    })

    it('accepts template message', () => {
      const result = validateMessage({
        type: 'template',
        altText: 'template',
        template: { type: 'buttons', text: 'Choose', actions: [] },
      })
      expect(result.valid).toBe(true)
    })
  })

  describe('invalid inputs', () => {
    it('rejects null', () => {
      const result = validateMessage(null)
      expect(result.valid).toBe(false)
    })

    it('rejects string', () => {
      const result = validateMessage('hello')
      expect(result.valid).toBe(false)
    })

    it('rejects array', () => {
      const result = validateMessage([])
      expect(result.valid).toBe(false)
    })

    it('rejects object without type', () => {
      const result = validateMessage({ text: 'hello' })
      expect(result.valid).toBe(false)
    })

    it('rejects object with non-string type', () => {
      const result = validateMessage({ type: 123 })
      expect(result.valid).toBe(false)
    })

    it('rejects unknown type', () => {
      const result = validateMessage({ type: 'custom' })
      expect(result.valid).toBe(false)
      if (!result.valid) {
        expect(result.error).toContain('custom')
      }
    })
  })

  describe('quickReply', () => {
    const messageItem = {
      type: 'action' as const,
      action: { type: 'message' as const, label: 'Yes', text: 'Yes' },
    }

    it('accepts text message with quickReply and stores it in metadata', () => {
      const result = validateMessage({
        type: 'text',
        text: 'pick one',
        quickReply: { items: [messageItem] },
      })
      expect(result.valid).toBe(true)
      if (result.valid) {
        expect(result.text).toBe('pick one')
        expect(result.metadata).not.toBeNull()
        const parsed = JSON.parse(result.metadata!)
        expect(parsed.quickReply.items[0].action.text).toBe('Yes')
      }
    })

    it('keeps text metadata null when quickReply is absent', () => {
      const result = validateMessage({ type: 'text', text: 'plain' })
      expect(result.valid).toBe(true)
      if (result.valid) expect(result.metadata).toBeNull()
    })

    it('merges quickReply into flex metadata alongside contents', () => {
      const result = validateMessage({
        type: 'flex',
        altText: 'alt',
        contents: {
          type: 'bubble',
          body: { type: 'box', layout: 'vertical', contents: [] },
        },
        quickReply: { items: [messageItem] },
      })
      expect(result.valid).toBe(true)
      if (result.valid) {
        const parsed = JSON.parse(result.metadata!)
        expect(parsed.type).toBe('flex')
        expect(parsed.contents.type).toBe('bubble')
        expect(parsed.quickReply.items).toHaveLength(1)
      }
    })

    it('merges quickReply into image metadata alongside originalContentUrl', () => {
      const result = validateMessage({
        type: 'image',
        originalContentUrl: 'https://example.com/i.png',
        previewImageUrl: 'https://example.com/p.png',
        quickReply: { items: [messageItem] },
      })
      expect(result.valid).toBe(true)
      if (result.valid) {
        const parsed = JSON.parse(result.metadata!)
        expect(parsed.originalContentUrl).toBe('https://example.com/i.png')
        expect(parsed.quickReply.items).toHaveLength(1)
      }
    })

    it('rejects text with invalid quickReply (camera action)', () => {
      const result = validateMessage({
        type: 'text',
        text: 'x',
        quickReply: {
          items: [{ type: 'action', action: { type: 'camera', label: 'C' } }],
        },
      })
      expect(result.valid).toBe(false)
      if (!result.valid) expect(result.error).toContain('quickReply')
    })

    it('rejects image with invalid quickReply (camera action)', () => {
      const result = validateMessage({
        type: 'image',
        originalContentUrl: 'https://example.com/i.png',
        previewImageUrl: 'https://example.com/p.png',
        quickReply: {
          items: [{ type: 'action', action: { type: 'camera', label: 'C' } }],
        },
      })
      expect(result.valid).toBe(false)
      if (!result.valid) expect(result.error).toContain('quickReply')
    })

    it('rejects text with quickReply exceeding 13 items', () => {
      const items = Array.from({ length: 14 }, (_, i) => ({
        type: 'action' as const,
        action: { type: 'message' as const, label: `B${i}`, text: `b${i}` },
      }))
      const result = validateMessage({ type: 'text', text: 'x', quickReply: { items } })
      expect(result.valid).toBe(false)
    })
  })

  describe('imagemap messages', () => {
    const validImagemap = {
      type: 'imagemap',
      baseUrl: 'https://example.com/bot/images/rm001',
      altText: 'alt',
      baseSize: { width: 1040, height: 1040 },
      actions: [
        {
          type: 'uri',
          linkUri: 'https://example.com',
          area: { x: 0, y: 0, width: 100, height: 100 },
        },
      ],
    }

    it('accepts valid imagemap', () => {
      const result = validateMessage(validImagemap)
      expect(result.valid).toBe(true)
      if (result.valid) {
        expect(result.type).toBe('imagemap')
        expect(result.text).toBeNull()
        expect(result.metadata).toBeTruthy()
        const meta = JSON.parse(result.metadata!)
        expect(meta.baseUrl).toBe('https://example.com/bot/images/rm001')
        expect(meta.actions).toHaveLength(1)
      }
    })

    it('rejects imagemap with baseUrl ending in .jpg', () => {
      const result = validateMessage({
        ...validImagemap,
        baseUrl: 'https://example.com/a/b.jpg',
      })
      expect(result.valid).toBe(false)
    })

    it('rejects imagemap with baseSize.width != 1040', () => {
      const result = validateMessage({
        ...validImagemap,
        baseSize: { width: 800, height: 1040 },
      })
      expect(result.valid).toBe(false)
    })

    it('rejects imagemap with empty actions', () => {
      const result = validateMessage({ ...validImagemap, actions: [] })
      expect(result.valid).toBe(false)
    })

    it('rejects imagemap with area overflowing baseSize', () => {
      const result = validateMessage({
        ...validImagemap,
        actions: [
          {
            type: 'uri',
            linkUri: 'https://x',
            area: { x: 500, y: 0, width: 600, height: 10 },
          },
        ],
      })
      expect(result.valid).toBe(false)
    })

    it('rejects postback as imagemap action', () => {
      const result = validateMessage({
        ...validImagemap,
        actions: [
          {
            type: 'postback',
            data: 'x=1',
            area: { x: 0, y: 0, width: 10, height: 10 },
          },
        ],
      })
      expect(result.valid).toBe(false)
    })

    it('accepts imagemap with quickReply', () => {
      const result = validateMessage({
        ...validImagemap,
        quickReply: {
          items: [
            {
              type: 'action',
              action: { type: 'message', label: 'Hi', text: 'Hi' },
            },
          ],
        },
      })
      expect(result.valid).toBe(true)
      if (result.valid) {
        const meta = JSON.parse(result.metadata!)
        expect(meta.quickReply).toBeDefined()
        expect(meta.quickReply.items).toHaveLength(1)
      }
    })

    it('rejects imagemap with invalid quickReply', () => {
      const result = validateMessage({
        ...validImagemap,
        quickReply: {
          items: [{ type: 'action', action: { type: 'camera', label: 'Cam' } }],
        },
      })
      expect(result.valid).toBe(false)
      if (!result.valid) {
        expect(result.code).toBe('INVALID_QUICK_REPLY')
      }
    })
  })
})
