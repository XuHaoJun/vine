import { describe, expect, it } from 'vitest'
import * as v from 'valibot'
import { ImagemapActionSchema } from './action'

const area = { x: 0, y: 0, width: 100, height: 100 }

describe('ImagemapActionSchema', () => {
  it('accepts uri action with HTTPS linkUri', () => {
    expect(
      v.safeParse(ImagemapActionSchema, {
        type: 'uri',
        linkUri: 'https://example.com',
        area,
      }).success,
    ).toBe(true)
  })

  it('accepts uri action with http scheme (LINE allows http/https/line/tel)', () => {
    expect(
      v.safeParse(ImagemapActionSchema, {
        type: 'uri',
        linkUri: 'http://example.com',
        area,
      }).success,
    ).toBe(true)
  })

  it('accepts message action', () => {
    expect(
      v.safeParse(ImagemapActionSchema, { type: 'message', text: 'hi', area }).success,
    ).toBe(true)
  })

  it('rejects message action with text > 400 chars', () => {
    expect(
      v.safeParse(ImagemapActionSchema, {
        type: 'message',
        text: 'x'.repeat(401),
        area,
      }).success,
    ).toBe(false)
  })

  it('rejects empty message text', () => {
    expect(
      v.safeParse(ImagemapActionSchema, { type: 'message', text: '', area }).success,
    ).toBe(false)
  })

  it('accepts clipboard action', () => {
    expect(
      v.safeParse(ImagemapActionSchema, {
        type: 'clipboard',
        clipboardText: 'copy me',
        area,
      }).success,
    ).toBe(true)
  })

  it('rejects clipboard with text > 1000 chars', () => {
    expect(
      v.safeParse(ImagemapActionSchema, {
        type: 'clipboard',
        clipboardText: 'x'.repeat(1001),
        area,
      }).success,
    ).toBe(false)
  })

  it('rejects empty clipboardText', () => {
    expect(
      v.safeParse(ImagemapActionSchema, {
        type: 'clipboard',
        clipboardText: '',
        area,
      }).success,
    ).toBe(false)
  })

  it('rejects postback action (not allowed on imagemap)', () => {
    expect(
      v.safeParse(ImagemapActionSchema, { type: 'postback', data: 'x=1', area }).success,
    ).toBe(false)
  })

  it('rejects datetimepicker action', () => {
    expect(
      v.safeParse(ImagemapActionSchema, {
        type: 'datetimepicker',
        data: 'x=1',
        mode: 'date',
        area,
      }).success,
    ).toBe(false)
  })

  it('rejects action without area', () => {
    expect(
      v.safeParse(ImagemapActionSchema, { type: 'uri', linkUri: 'https://x' }).success,
    ).toBe(false)
  })

  it('accepts optional label', () => {
    expect(
      v.safeParse(ImagemapActionSchema, {
        type: 'uri',
        label: 'Open',
        linkUri: 'https://x',
        area,
      }).success,
    ).toBe(true)
  })

  it('rejects label > 100 chars', () => {
    expect(
      v.safeParse(ImagemapActionSchema, {
        type: 'uri',
        label: 'x'.repeat(101),
        linkUri: 'https://x',
        area,
      }).success,
    ).toBe(false)
  })
})
