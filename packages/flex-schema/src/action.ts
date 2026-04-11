import * as v from 'valibot'
import { FlexUrlSchema } from './primitives'

// ============ Individual Actions ============

export const FlexURIActionSchema = v.object({
  type: v.literal('uri'),
  label: v.optional(v.string()),
  uri: FlexUrlSchema,
  altUri: v.optional(
    v.object({
      desktop: v.optional(v.string()),
    }),
  ),
})

export const FlexMessageActionSchema = v.object({
  type: v.literal('message'),
  label: v.optional(v.string()),
  text: v.string(),
})

export const FlexPostbackActionSchema = v.object({
  type: v.literal('postback'),
  label: v.optional(v.string()),
  data: v.string(),
  displayText: v.optional(v.string()),
  inputOption: v.optional(v.picklist(['openKeyboard', 'closeRichMenu'])),
  fillInText: v.optional(v.string()),
})

export const FlexDatetimePickerActionSchema = v.object({
  type: v.literal('datetimepicker'),
  label: v.optional(v.string()),
  data: v.string(),
  mode: v.picklist(['date', 'time', 'datetime']),
  initial: v.optional(v.string()),
  max: v.optional(v.string()),
  min: v.optional(v.string()),
})

export const FlexClipboardActionSchema = v.object({
  type: v.literal('clipboard'),
  label: v.optional(v.string()),
  clipboardText: v.string(),
})

export const FlexCameraActionSchema = v.object({
  type: v.literal('camera'),
  label: v.optional(v.string()),
})

export const FlexCameraRollActionSchema = v.object({
  type: v.literal('cameraRoll'),
  label: v.optional(v.string()),
})

export const FlexLocationActionSchema = v.object({
  type: v.literal('location'),
  label: v.optional(v.string()),
})

export const FlexRichMenuSwitchActionSchema = v.object({
  type: v.literal('richmenuswitch'),
  label: v.optional(v.string()),
  richMenuAliasId: v.string(),
  data: v.optional(v.string()),
})

// ============ Union ============

export const FlexActionSchema = v.union([
  FlexURIActionSchema,
  FlexMessageActionSchema,
  FlexPostbackActionSchema,
  FlexDatetimePickerActionSchema,
  FlexClipboardActionSchema,
  FlexCameraActionSchema,
  FlexCameraRollActionSchema,
  FlexLocationActionSchema,
  FlexRichMenuSwitchActionSchema,
])

export type FlexAction = v.InferInput<typeof FlexActionSchema>
