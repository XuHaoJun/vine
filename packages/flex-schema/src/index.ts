import * as v from 'valibot'

// Primitives
export {
  // Enums
  FlexLayoutSchema,
  FlexGravitySchema,
  FlexAlignSchema,
  FlexPositionSchema,
  FlexDirectionSchema,
  FlexWeightSchema,
  FlexStyleSchema,
  FlexDecorationSchema,
  FlexAspectModeSchema,
  FlexAdjustModeSchema,
  FlexButtonStyleSchema,
  FlexButtonHeightSchema,
  FlexSpacingSchema,
  FlexMarginSchema,
  FlexSizeSchema,
  FlexTextSizeSchema,
  FlexBorderWidthSchema,
  FlexBubbleSizeSchema,
  FlexAspectRatioSchema,
  FlexJustifyContentSchema,
  FlexAlignItemsSchema,
  // Value validators
  FlexPixelSchema,
  FlexColorSchema,
  FlexHttpsUrlSchema,
  FlexUrlSchema,
  FlexAspectRatioValueSchema,
  // Dual-mode validators
  FlexMarginValueSchema,
  FlexSpacingValueSchema,
  FlexSizeValueSchema,
  FlexTextSizeValueSchema,
  FlexCornerRadiusSchema,
  FlexDimensionSchema,
  FlexBorderWidthValueSchema,
  FlexLineSpacingSchema,
  FlexBackgroundSchema,
} from './primitives'

// Actions
export {
  FlexURIActionSchema,
  FlexMessageActionSchema,
  FlexPostbackActionSchema,
  FlexDatetimePickerActionSchema,
  FlexClipboardActionSchema,
  FlexCameraActionSchema,
  FlexCameraRollActionSchema,
  FlexLocationActionSchema,
  FlexRichMenuSwitchActionSchema,
  FlexActionSchema,
} from './action'
export type { FlexAction } from './action'

// Quick Reply
export {
  QuickReplyActionSchema,
  QuickReplyItemSchema,
  QuickReplySchema,
} from './quickReply'
export type { QuickReply, QuickReplyItem, QuickReplyAction } from './quickReply'

// Components
export {
  FlexSpanSchema,
  FlexTextSchema,
  FlexButtonSchema,
  FlexIconSchema,
  FlexImageSchema,
  FlexSeparatorSchema,
  FlexFillerSchema,
  FlexSpacerSchema,
  FlexVideoSchema,
  FlexBoxSchema,
  FlexComponentSchema,
} from './components'

// Containers
export {
  FlexBlockStyleSchema,
  FlexBubbleStylesSchema,
  FlexHeroSchema,
  FlexBubbleSchema,
  FlexCarouselSchema,
  FlexContainerSchema,
  FlexMessageSchema,
} from './containers'

// ============ Convenience Functions ============

export type FlexValidationSuccess = {
  success: true
  data: v.InferOutput<typeof FlexMessageSchema>
}

export type FlexValidationFailure = {
  success: false
  errors: Array<{ path: string; message: string }>
}

export type FlexValidationResult = FlexValidationSuccess | FlexValidationFailure

import { FlexMessageSchema, FlexBubbleSchema } from './containers'

export function validateFlexMessage(input: unknown): FlexValidationResult {
  const result = v.safeParse(FlexMessageSchema, input)
  if (result.success) {
    return { success: true, data: result.output }
  }
  return {
    success: false,
    errors: result.issues.map((issue) => ({
      path: issue.path?.map((p: v.IssuePathItem) => String(p.key)).join('.') ?? '',
      message: issue.message,
    })),
  }
}

export function validateFlexBubble(input: unknown) {
  const result = v.safeParse(FlexBubbleSchema, input)
  if (result.success) return { success: true, data: result.output }
  return { success: false, issues: result.issues }
}
