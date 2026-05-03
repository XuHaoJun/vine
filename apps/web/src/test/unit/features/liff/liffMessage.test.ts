import { describe, expect, it } from 'vitest'
import {
  validateAndConvertLiffMessages,
  type ConvertedLiffMessage,
  type LiffMessageMethod,
} from '~/features/liff/liffMessage'

const HTTPS_IMAGE = 'https://example.com/image.jpg'
const HTTPS_VIDEO = 'https://example.com/video.mp4'
const HTTPS_AUDIO = 'https://example.com/audio.mp3'

function makeTextMessage(text = 'hello') {
  return { type: 'text', text }
}

function makeStickerMessage(packageId = '1', stickerId = 1) {
  return { type: 'sticker', packageId, stickerId }
}

function makeImageMessage(url = HTTPS_IMAGE) {
  return {
    type: 'image',
    originalContentUrl: url,
    previewImageUrl: url,
  }
}

function makeVideoMessage(url = HTTPS_VIDEO) {
  return {
    type: 'video',
    originalContentUrl: url,
    previewImageUrl: HTTPS_IMAGE,
  }
}

function makeAudioMessage(url = HTTPS_AUDIO) {
  return {
    type: 'audio',
    originalContentUrl: url,
    duration: 5000,
  }
}

function makeLocationMessage() {
  return {
    type: 'location',
    title: 'Station',
    address: '1 Main St',
    latitude: 35.6812,
    longitude: 139.7671,
  }
}

function makeFlexUriMessage() {
  return {
    type: 'flex',
    altText: 'Flex',
    contents: {
      type: 'bubble',
      body: {
        type: 'box',
        layout: 'vertical',
        contents: [
          {
            type: 'button',
            action: { type: 'uri', label: 'Open', uri: 'https://example.com' },
          },
        ],
      },
    },
  }
}

function makeFlexNonUriMessage() {
  return {
    type: 'flex',
    altText: 'Flex',
    contents: {
      type: 'bubble',
      body: {
        type: 'box',
        layout: 'vertical',
        contents: [
          {
            type: 'button',
            action: { type: 'postback', label: 'Tap', data: 'id=1' },
          },
        ],
      },
    },
  }
}

describe('validateAndConvertLiffMessages', () => {
  describe('sendMessages method', () => {
    it('accepts text message', () => {
      const result = validateAndConvertLiffMessages({
        method: 'sendMessages',
        messages: [makeTextMessage('hi')],
      })
      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.messages).toHaveLength(1)
        expect(result.messages[0]!.type).toBe('text')
        expect(result.messages[0]!.text).toBe('hi')
        expect(result.messages[0]!.metadata).toBeNull()
      }
    })

    it('accepts sticker message', () => {
      const result = validateAndConvertLiffMessages({
        method: 'sendMessages',
        messages: [makeStickerMessage('1', 100)],
      })
      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.messages[0]!.type).toBe('sticker')
      }
    })

    it('accepts image message', () => {
      const result = validateAndConvertLiffMessages({
        method: 'sendMessages',
        messages: [makeImageMessage()],
      })
      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.messages[0]!.type).toBe('image')
      }
    })

    it('accepts video message', () => {
      const result = validateAndConvertLiffMessages({
        method: 'sendMessages',
        messages: [makeVideoMessage()],
      })
      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.messages[0]!.type).toBe('video')
      }
    })

    it('accepts audio message', () => {
      const result = validateAndConvertLiffMessages({
        method: 'sendMessages',
        messages: [makeAudioMessage()],
      })
      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.messages[0]!.type).toBe('audio')
      }
    })

    it('accepts location message', () => {
      const result = validateAndConvertLiffMessages({
        method: 'sendMessages',
        messages: [makeLocationMessage()],
      })
      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.messages[0]!.type).toBe('location')
      }
    })

    it('accepts flex message with only URI actions', () => {
      const result = validateAndConvertLiffMessages({
        method: 'sendMessages',
        messages: [makeFlexUriMessage()],
      })
      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.messages[0]!.type).toBe('flex')
      }
    })
  })

  describe('shareTargetPicker method', () => {
    it('accepts text message', () => {
      const result = validateAndConvertLiffMessages({
        method: 'shareTargetPicker',
        messages: [makeTextMessage()],
      })
      expect(result.ok).toBe(true)
    })

    it('accepts image message', () => {
      const result = validateAndConvertLiffMessages({
        method: 'shareTargetPicker',
        messages: [makeImageMessage()],
      })
      expect(result.ok).toBe(true)
    })

    it('accepts video message', () => {
      const result = validateAndConvertLiffMessages({
        method: 'shareTargetPicker',
        messages: [makeVideoMessage()],
      })
      expect(result.ok).toBe(true)
    })

    it('accepts audio message', () => {
      const result = validateAndConvertLiffMessages({
        method: 'shareTargetPicker',
        messages: [makeAudioMessage()],
      })
      expect(result.ok).toBe(true)
    })

    it('accepts location message', () => {
      const result = validateAndConvertLiffMessages({
        method: 'shareTargetPicker',
        messages: [makeLocationMessage()],
      })
      expect(result.ok).toBe(true)
    })

    it('accepts flex message with only URI actions', () => {
      const result = validateAndConvertLiffMessages({
        method: 'shareTargetPicker',
        messages: [makeFlexUriMessage()],
      })
      expect(result.ok).toBe(true)
    })
  })

  describe('array validation', () => {
    it('rejects empty array', () => {
      const result = validateAndConvertLiffMessages({
        method: 'sendMessages',
        messages: [],
      })
      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error.code).toBe('INVALID_ARGUMENT')
      }
    })

    it('rejects more than five messages', () => {
      const messages = Array.from({ length: 6 }, () => makeTextMessage())
      const result = validateAndConvertLiffMessages({
        method: 'sendMessages',
        messages,
      })
      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error.code).toBe('INVALID_ARGUMENT')
      }
    })

    it('accepts exactly five messages', () => {
      const messages = Array.from({ length: 5 }, () => makeTextMessage())
      const result = validateAndConvertLiffMessages({
        method: 'sendMessages',
        messages,
      })
      expect(result.ok).toBe(true)
    })
  })

  describe('rejects unsupported properties', () => {
    it('rejects quickReply', () => {
      const result = validateAndConvertLiffMessages({
        method: 'sendMessages',
        messages: [{ ...makeTextMessage(), quickReply: { items: [] } }],
      })
      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error.code).toBe('INVALID_ARGUMENT')
      }
    })

    it('rejects quoteToken', () => {
      const result = validateAndConvertLiffMessages({
        method: 'sendMessages',
        messages: [{ ...makeTextMessage(), quoteToken: 'tok' }],
      })
      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error.code).toBe('INVALID_ARGUMENT')
      }
    })

    it('rejects text emojis', () => {
      const result = validateAndConvertLiffMessages({
        method: 'sendMessages',
        messages: [
          {
            type: 'text',
            text: 'hi',
            emojis: [{ index: 0, productId: 'p', emojiId: 'e' }],
          },
        ],
      })
      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error.code).toBe('INVALID_ARGUMENT')
      }
    })

    it('rejects video trackingId', () => {
      const result = validateAndConvertLiffMessages({
        method: 'sendMessages',
        messages: [{ ...makeVideoMessage(), trackingId: 'track' }],
      })
      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error.code).toBe('INVALID_ARGUMENT')
      }
    })
  })

  describe('rejects disallowed types', () => {
    it('rejects template for sendMessages', () => {
      const result = validateAndConvertLiffMessages({
        method: 'sendMessages',
        messages: [
          { type: 'template', altText: 't', template: { type: 'buttons', actions: [] } },
        ],
      })
      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error.code).toBe('UNSUPPORTED_MESSAGE')
      }
    })

    it('rejects template for shareTargetPicker', () => {
      const result = validateAndConvertLiffMessages({
        method: 'shareTargetPicker',
        messages: [
          { type: 'template', altText: 't', template: { type: 'buttons', actions: [] } },
        ],
      })
      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error.code).toBe('UNSUPPORTED_MESSAGE')
      }
    })

    it('rejects imagemap for sendMessages', () => {
      const result = validateAndConvertLiffMessages({
        method: 'sendMessages',
        messages: [
          {
            type: 'imagemap',
            baseUrl: 'https://example.com',
            baseSize: { width: 1040, height: 1040 },
            altText: 'im',
            actions: [],
          },
        ],
      })
      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error.code).toBe('UNSUPPORTED_MESSAGE')
      }
    })

    it('rejects imagemap for shareTargetPicker', () => {
      const result = validateAndConvertLiffMessages({
        method: 'shareTargetPicker',
        messages: [
          {
            type: 'imagemap',
            baseUrl: 'https://example.com',
            baseSize: { width: 1040, height: 1040 },
            altText: 'im',
            actions: [],
          },
        ],
      })
      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error.code).toBe('UNSUPPORTED_MESSAGE')
      }
    })

    it('rejects sticker for shareTargetPicker', () => {
      const result = validateAndConvertLiffMessages({
        method: 'shareTargetPicker',
        messages: [makeStickerMessage()],
      })
      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error.code).toBe('UNSUPPORTED_MESSAGE')
      }
    })
  })

  describe('flex action validation', () => {
    it('rejects non-URI flex actions', () => {
      const result = validateAndConvertLiffMessages({
        method: 'sendMessages',
        messages: [makeFlexNonUriMessage()],
      })
      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error.code).toBe('INVALID_ARGUMENT')
      }
    })

    it('rejects deeply nested non-URI flex actions', () => {
      const result = validateAndConvertLiffMessages({
        method: 'sendMessages',
        messages: [
          {
            type: 'flex',
            altText: 'Flex',
            contents: {
              type: 'bubble',
              header: {
                type: 'box',
                layout: 'vertical',
                contents: [
                  {
                    type: 'button',
                    action: { type: 'uri', label: 'OK', uri: 'https://example.com' },
                  },
                ],
              },
              body: {
                type: 'box',
                layout: 'vertical',
                contents: [
                  {
                    type: 'button',
                    action: {
                      type: 'datetimepicker',
                      label: 'Pick',
                      data: 'd',
                      mode: 'date',
                    },
                  },
                ],
              },
            },
          },
        ],
      })
      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error.code).toBe('INVALID_ARGUMENT')
      }
    })
  })

  describe('sticker package entitlement', () => {
    it('allows public/system package IDs without canUseStickerPackage', () => {
      const result = validateAndConvertLiffMessages({
        method: 'sendMessages',
        messages: [makeStickerMessage('1', 100)],
      })
      expect(result.ok).toBe(true)
    })

    it('calls canUseStickerPackage for Vine marketplace package IDs', () => {
      let called = false
      const result = validateAndConvertLiffMessages({
        method: 'sendMessages',
        messages: [makeStickerMessage('pkg_cat_01', 1)],
        canUseStickerPackage: (pkgId) => {
          called = true
          return pkgId === 'pkg_cat_01'
        },
      })
      expect(called).toBe(true)
      expect(result.ok).toBe(true)
    })

    it('rejects marketplace package when canUseStickerPackage returns false', () => {
      const result = validateAndConvertLiffMessages({
        method: 'sendMessages',
        messages: [makeStickerMessage('pkg_cat_01', 1)],
        canUseStickerPackage: () => false,
      })
      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error.code).toBe('PERMISSION_DENIED')
      }
    })
  })

  describe('URL validation', () => {
    it('rejects non-HTTPS image URL', () => {
      const result = validateAndConvertLiffMessages({
        method: 'sendMessages',
        messages: [makeImageMessage('http://example.com/image.jpg')],
      })
      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error.code).toBe('INVALID_ARGUMENT')
      }
    })

    it('rejects non-HTTPS video URL', () => {
      const result = validateAndConvertLiffMessages({
        method: 'sendMessages',
        messages: [makeVideoMessage('http://example.com/video.mp4')],
      })
      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error.code).toBe('INVALID_ARGUMENT')
      }
    })

    it('rejects non-HTTPS audio URL', () => {
      const result = validateAndConvertLiffMessages({
        method: 'sendMessages',
        messages: [makeAudioMessage('ftp://example.com/audio.mp3')],
      })
      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error.code).toBe('INVALID_ARGUMENT')
      }
    })
  })

  describe('metadata conversion', () => {
    it('preserves metadata in MessageBubbleFactory-compatible shape for text', () => {
      const result = validateAndConvertLiffMessages({
        method: 'sendMessages',
        messages: [makeTextMessage('hello')],
      })
      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.messages[0]).toEqual({
          type: 'text',
          text: 'hello',
          metadata: null,
        })
      }
    })

    it('preserves metadata in MessageBubbleFactory-compatible shape for sticker', () => {
      const result = validateAndConvertLiffMessages({
        method: 'sendMessages',
        messages: [makeStickerMessage('1', 42)],
      })
      expect(result.ok).toBe(true)
      if (result.ok) {
        const msg = result.messages[0]!
        expect(msg.type).toBe('sticker')
        expect(msg.text).toBeNull()
        const meta = JSON.parse(msg.metadata!)
        expect(meta).toEqual({ packageId: '1', stickerId: 42 })
      }
    })

    it('preserves metadata in MessageBubbleFactory-compatible shape for image', () => {
      const result = validateAndConvertLiffMessages({
        method: 'sendMessages',
        messages: [makeImageMessage()],
      })
      expect(result.ok).toBe(true)
      if (result.ok) {
        const msg = result.messages[0]!
        expect(msg.type).toBe('image')
        expect(msg.text).toBeNull()
        const meta = JSON.parse(msg.metadata!)
        expect(meta.originalContentUrl).toBe(HTTPS_IMAGE)
        expect(meta.previewImageUrl).toBe(HTTPS_IMAGE)
      }
    })

    it('preserves metadata in MessageBubbleFactory-compatible shape for video', () => {
      const result = validateAndConvertLiffMessages({
        method: 'sendMessages',
        messages: [makeVideoMessage()],
      })
      expect(result.ok).toBe(true)
      if (result.ok) {
        const msg = result.messages[0]!
        expect(msg.type).toBe('video')
        const meta = JSON.parse(msg.metadata!)
        expect(meta.originalContentUrl).toBe(HTTPS_VIDEO)
      }
    })

    it('preserves metadata in MessageBubbleFactory-compatible shape for audio', () => {
      const result = validateAndConvertLiffMessages({
        method: 'sendMessages',
        messages: [makeAudioMessage()],
      })
      expect(result.ok).toBe(true)
      if (result.ok) {
        const msg = result.messages[0]!
        expect(msg.type).toBe('audio')
        const meta = JSON.parse(msg.metadata!)
        expect(meta.originalContentUrl).toBe(HTTPS_AUDIO)
        expect(meta.duration).toBe(5000)
      }
    })

    it('preserves metadata in MessageBubbleFactory-compatible shape for location', () => {
      const result = validateAndConvertLiffMessages({
        method: 'sendMessages',
        messages: [makeLocationMessage()],
      })
      expect(result.ok).toBe(true)
      if (result.ok) {
        const msg = result.messages[0]!
        expect(msg.type).toBe('location')
        const meta = JSON.parse(msg.metadata!)
        expect(meta.title).toBe('Station')
        expect(meta.address).toBe('1 Main St')
        expect(meta.latitude).toBe(35.6812)
        expect(meta.longitude).toBe(139.7671)
      }
    })

    it('preserves metadata in MessageBubbleFactory-compatible shape for flex', () => {
      const result = validateAndConvertLiffMessages({
        method: 'sendMessages',
        messages: [makeFlexUriMessage()],
      })
      expect(result.ok).toBe(true)
      if (result.ok) {
        const msg = result.messages[0]!
        expect(msg.type).toBe('flex')
        expect(msg.text).toBeNull()
        const meta = JSON.parse(msg.metadata!)
        expect(meta.type).toBe('bubble')
      }
    })
  })
})
