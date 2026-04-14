import * as v from 'valibot'

const HttpsUrlSchema = v.pipe(
  v.string(),
  v.url('Invalid URL'),
  v.startsWith('https://', 'Must use HTTPS'),
)

export const RichMenuPostbackActionSchema = v.object({
  type: v.literal('postback'),
  label: v.optional(v.string()),
  data: v.pipe(v.string(), v.maxLength(300, 'data must be at most 300 characters')),
  displayText: v.optional(v.string()),
  inputOption: v.optional(
    v.picklist(['closeRichMenu', 'openRichMenu', 'openKeyboard', 'openVoice']),
  ),
  fillInText: v.optional(v.string()),
})

export const RichMenuMessageActionSchema = v.object({
  type: v.literal('message'),
  label: v.optional(v.string()),
  text: v.pipe(v.string(), v.maxLength(300, 'text must be at most 300 characters')),
})

export const RichMenuUriActionSchema = v.object({
  type: v.literal('uri'),
  label: v.optional(v.string()),
  uri: HttpsUrlSchema,
  altUri: v.optional(
    v.object({
      desktop: v.optional(v.string()),
    }),
  ),
})

export const RichMenuDatetimepickerActionSchema = v.object({
  type: v.literal('datetimepicker'),
  label: v.optional(v.string()),
  data: v.pipe(v.string(), v.maxLength(300, 'data must be at most 300 characters')),
  mode: v.picklist(['date', 'time', 'datetime']),
  initial: v.optional(v.string()),
  max: v.optional(v.string()),
  min: v.optional(v.string()),
})

export const RichMenuRichmenuswitchActionSchema = v.object({
  type: v.literal('richmenuswitch'),
  label: v.optional(v.string()),
  richMenuAliasId: v.pipe(
    v.string(),
    v.maxLength(32, 'richMenuAliasId must be at most 32 characters'),
  ),
  data: v.pipe(v.string(), v.maxLength(300, 'data must be at most 300 characters')),
})

export const RichMenuCameraActionSchema = v.object({
  type: v.literal('camera'),
  label: v.optional(v.string()),
})

export const RichMenuCameraRollActionSchema = v.object({
  type: v.literal('cameraRoll'),
  label: v.optional(v.string()),
})

export const RichMenuLocationActionSchema = v.object({
  type: v.literal('location'),
  label: v.optional(v.string()),
})

export const RichMenuActionSchema = v.union([
  RichMenuPostbackActionSchema,
  RichMenuMessageActionSchema,
  RichMenuUriActionSchema,
  RichMenuDatetimepickerActionSchema,
  RichMenuRichmenuswitchActionSchema,
  RichMenuCameraActionSchema,
  RichMenuCameraRollActionSchema,
  RichMenuLocationActionSchema,
])

export type RichMenuAction = v.InferInput<typeof RichMenuActionSchema>
