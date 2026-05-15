import * as v from 'valibot'
import { describe, expect, it } from 'vitest'
import { validateRichMenu, RichMenuObjectSchema, RichMenuActionSchema } from './index'
import { validateRichMenuImageUpload } from './image'

describe('validateRichMenu', () => {
  it('validates a valid rich menu object', () => {
    const validMenu = {
      size: { width: 2500, height: 1686 },
      selected: false,
      name: 'Test Menu',
      chatBarText: 'Open menu',
      areas: [
        {
          bounds: { x: 0, y: 0, width: 2500, height: 1686 },
          action: {
            type: 'postback',
            data: 'action=buy&itemid=123',
          },
        },
      ],
    }
    const result = validateRichMenu(validMenu)
    expect(result.success).toBe(true)
  })

  it('rejects invalid size (width not 2500)', () => {
    const invalidMenu = {
      size: { width: 1000, height: 1686 },
      selected: false,
      name: 'Test Menu',
      chatBarText: 'Open menu',
      areas: [],
    }
    const result = validateRichMenu(invalidMenu)
    expect(result.success).toBe(false)
  })

  it('rejects areas exceeding 20 items', () => {
    const invalidMenu = {
      size: { width: 2500, height: 1686 },
      selected: false,
      name: 'Test Menu',
      chatBarText: 'Open menu',
      areas: Array.from({ length: 21 }, (_, i) => ({
        bounds: { x: 0, y: 0, width: 100, height: 100 },
        action: { type: 'postback', data: `action=${i}` },
      })),
    }
    const result = validateRichMenu(invalidMenu)
    expect(result.success).toBe(false)
  })

  it('rejects name longer than 30 characters', () => {
    const invalidMenu = {
      size: { width: 2500, height: 1686 },
      selected: false,
      name: 'A'.repeat(31),
      chatBarText: 'Open menu',
      areas: [],
    }
    const result = validateRichMenu(invalidMenu)
    expect(result.success).toBe(false)
  })

  it('rejects unsupported rich menu object height', () => {
    const result = validateRichMenu({
      size: { width: 2500, height: 1000 },
      selected: false,
      name: 'Test Menu',
      chatBarText: 'Open menu',
      areas: [],
    })
    expect(result.success).toBe(false)
  })

  it('rejects tappable areas outside menu bounds', () => {
    const result = validateRichMenu({
      size: { width: 2500, height: 843 },
      selected: false,
      name: 'Test Menu',
      chatBarText: 'Open menu',
      areas: [
        {
          bounds: { x: 2400, y: 0, width: 200, height: 100 },
          action: { type: 'message', text: 'outside' },
        },
      ],
    })
    expect(result.success).toBe(false)
  })
})

describe('RichMenuActionSchema', () => {
  it('validates postback action with required fields', () => {
    const action = { type: 'postback', data: 'action=buy' }
    const result = v.parse(RichMenuActionSchema, action)
    expect(result.type).toBe('postback')
  })

  it('validates message action with required text', () => {
    const action = { type: 'message', text: 'Hello' }
    const result = v.parse(RichMenuActionSchema, action)
    expect(result.type).toBe('message')
  })

  it('rejects message action without text', () => {
    const action = { type: 'message' }
    expect(() => v.parse(RichMenuActionSchema, action)).toThrow()
  })

  it('validates datetimepicker with required mode', () => {
    const action = { type: 'datetimepicker', data: 'date', mode: 'date' }
    const result = v.parse(RichMenuActionSchema, action)
    expect(result.type).toBe('datetimepicker')
  })

  it('rejects datetimepicker without mode', () => {
    const action = { type: 'datetimepicker', data: 'date' }
    expect(() => v.parse(RichMenuActionSchema, action)).toThrow()
  })

  it('validates richmenuswitch with richMenuAliasId and data', () => {
    const action = {
      type: 'richmenuswitch',
      richMenuAliasId: 'my-alias',
      data: 'switched',
    }
    const result = v.parse(RichMenuActionSchema, action)
    expect(result.type).toBe('richmenuswitch')
  })

  it('rejects richmenuswitch without richMenuAliasId', () => {
    const action = { type: 'richmenuswitch', data: 'switched' }
    expect(() => v.parse(RichMenuActionSchema, action)).toThrow()
  })

  it('validates uri action with https URL', () => {
    const action = { type: 'uri', uri: 'https://example.com' }
    const result = v.parse(RichMenuActionSchema, action)
    expect(result.type).toBe('uri')
  })

  it('rejects uri action with http URL', () => {
    const action = { type: 'uri', uri: 'http://example.com' }
    expect(() => v.parse(RichMenuActionSchema, action)).toThrow()
  })

  it('validates camera action (label only)', () => {
    const action = { type: 'camera', label: 'Take photo' }
    const result = v.parse(RichMenuActionSchema, action)
    expect(result.type).toBe('camera')
  })

  it('validates postback with inputOption', () => {
    const action = {
      type: 'postback',
      data: 'action',
      inputOption: 'openRichMenu',
    }
    const result = v.parse(RichMenuActionSchema, action)
    expect(result.type).toBe('postback')
  })

  it('rejects postback with invalid inputOption', () => {
    const action = {
      type: 'postback',
      data: 'action',
      inputOption: 'invalidOption',
    }
    expect(() => v.parse(RichMenuActionSchema, action)).toThrow()
  })
})

describe('validateRichMenuImageUpload', () => {
  function makePngHeader(width: number, height: number) {
    const bytes = new Uint8Array(24)
    bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0)
    const dataView = new DataView(bytes.buffer)
    dataView.setUint32(16, width)
    dataView.setUint32(20, height)
    return bytes
  }

  it('rejects non-JPEG/PNG content types', () => {
    const result = validateRichMenuImageUpload({
      contentType: 'image/gif',
      bytes: new Uint8Array(100),
      expectedWidth: 2500,
      expectedHeight: 843,
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.message).toContain('JPEG or PNG')
    }
  })

  it('rejects images over 1 MB', () => {
    const largeBuffer = new Uint8Array(1024 * 1024 + 1).fill(0)
    const result = validateRichMenuImageUpload({
      contentType: 'image/png',
      bytes: largeBuffer,
      expectedWidth: 2500,
      expectedHeight: 843,
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.message).toContain('1 MB')
    }
  })

  it('rejects images with wrong dimensions', () => {
    const png = makePngHeader(2500, 1686)
    const result = validateRichMenuImageUpload({
      contentType: 'image/png',
      bytes: png,
      expectedWidth: 2500,
      expectedHeight: 843,
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.message).toContain('2500x843')
    }
  })

  it('accepts valid PNG with correct dimensions', () => {
    const png = makePngHeader(2500, 843)
    const result = validateRichMenuImageUpload({
      contentType: 'image/png',
      bytes: png,
      expectedWidth: 2500,
      expectedHeight: 843,
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.extension).toBe('png')
    }
  })

  it('accepts JPEG content type with .jpg extension', () => {
    const buf = new Uint8Array(19)
    buf[0] = 0xff; buf[1] = 0xd8
    buf[2] = 0xff; buf[3] = 0xc0
    buf[4] = 0x00; buf[5] = 0x11
    buf[6] = 0x08
    buf[7] = 0x09; buf[8] = 0xc4
    buf[9] = 0x03; buf[10] = 0x4b
    buf[11] = 0x01
    const result = validateRichMenuImageUpload({
      contentType: 'image/jpeg',
      bytes: buf,
      expectedWidth: 843,
      expectedHeight: 2500,
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.extension).toBe('jpg')
    }
  })

  it('handles content type with charset parameter', () => {
    const png = makePngHeader(2500, 843)
    const result = validateRichMenuImageUpload({
      contentType: 'image/png; charset=utf-8',
      bytes: png,
      expectedWidth: 2500,
      expectedHeight: 843,
    })
    expect(result.success).toBe(true)
  })
})
