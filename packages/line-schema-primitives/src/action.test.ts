import { describe, expect, it } from 'vitest'
import * as v from 'valibot'
import {
  FlexActionSchema,
  FlexURIActionSchema,
  FlexMessageActionSchema,
  FlexPostbackActionSchema,
  FlexDatetimePickerActionSchema,
  FlexClipboardActionSchema,
  FlexCameraActionSchema,
  FlexCameraRollActionSchema,
  FlexLocationActionSchema,
  FlexRichMenuSwitchActionSchema,
} from './action'

describe('Individual action schemas', () => {
  it('uri', () => {
    expect(
      v.safeParse(FlexURIActionSchema, {
        type: 'uri',
        uri: 'https://example.com',
      }).success,
    ).toBe(true)
  })

  it('message', () => {
    expect(
      v.safeParse(FlexMessageActionSchema, { type: 'message', text: 'hi' }).success,
    ).toBe(true)
  })

  it('postback', () => {
    expect(
      v.safeParse(FlexPostbackActionSchema, { type: 'postback', data: 'x=1' }).success,
    ).toBe(true)
  })

  it('datetimepicker', () => {
    expect(
      v.safeParse(FlexDatetimePickerActionSchema, {
        type: 'datetimepicker',
        data: 'x=1',
        mode: 'date',
      }).success,
    ).toBe(true)
  })

  it('clipboard', () => {
    expect(
      v.safeParse(FlexClipboardActionSchema, { type: 'clipboard', clipboardText: 'a' })
        .success,
    ).toBe(true)
  })

  it('camera / cameraRoll / location / richmenuswitch', () => {
    expect(v.safeParse(FlexCameraActionSchema, { type: 'camera' }).success).toBe(true)
    expect(v.safeParse(FlexCameraRollActionSchema, { type: 'cameraRoll' }).success).toBe(
      true,
    )
    expect(v.safeParse(FlexLocationActionSchema, { type: 'location' }).success).toBe(true)
    expect(
      v.safeParse(FlexRichMenuSwitchActionSchema, {
        type: 'richmenuswitch',
        richMenuAliasId: 'alias-1',
      }).success,
    ).toBe(true)
  })
})

describe('FlexActionSchema (union)', () => {
  it('accepts uri action', () => {
    expect(
      v.safeParse(FlexActionSchema, { type: 'uri', uri: 'https://x' }).success,
    ).toBe(true)
  })
  it('rejects unknown action type', () => {
    expect(v.safeParse(FlexActionSchema, { type: 'nonsense' }).success).toBe(false)
  })
})
