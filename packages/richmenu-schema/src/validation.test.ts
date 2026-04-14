import { describe, expect, it } from 'vitest'
import * as v from 'valibot'
import { validateRichMenu, RichMenuObjectSchema, RichMenuActionSchema } from './index'

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
