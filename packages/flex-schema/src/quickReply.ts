import * as v from 'valibot'
import {
  FlexClipboardActionSchema,
  FlexDatetimePickerActionSchema,
  FlexMessageActionSchema,
  FlexPostbackActionSchema,
  FlexURIActionSchema,
} from './action'
import { FlexHttpsUrlSchema } from './primitives'

// v1 (C1) action subset. camera / cameraRoll / location / richmenuswitch
// are intentionally excluded — see docs/superpowers/specs/2026-04-19-line-quick-reply-design.md.
export const QuickReplyActionSchema = v.union([
  FlexMessageActionSchema,
  FlexURIActionSchema,
  FlexPostbackActionSchema,
  FlexDatetimePickerActionSchema,
  FlexClipboardActionSchema,
])

export const QuickReplyItemSchema = v.object({
  type: v.literal('action'),
  imageUrl: v.optional(FlexHttpsUrlSchema),
  action: QuickReplyActionSchema,
})

export const QuickReplySchema = v.object({
  items: v.pipe(
    v.array(QuickReplyItemSchema),
    v.minLength(1),
    v.maxLength(13), // LINE spec
  ),
})

export type QuickReply = v.InferInput<typeof QuickReplySchema>
export type QuickReplyItem = v.InferInput<typeof QuickReplyItemSchema>
export type QuickReplyAction = v.InferInput<typeof QuickReplyActionSchema>
