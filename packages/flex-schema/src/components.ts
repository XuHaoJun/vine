import * as v from 'valibot'
import { FlexActionSchema } from './action'
import {
  FlexAdjustModeSchema,
  FlexAlignItemsSchema,
  FlexAlignSchema,
  FlexAspectRatioSchema,
  FlexAspectModeSchema,
  FlexBackgroundSchema,
  FlexBorderWidthValueSchema,
  FlexButtonHeightSchema,
  FlexButtonStyleSchema,
  FlexColorSchema,
  FlexCornerRadiusSchema,
  FlexDecorationSchema,
  FlexDimensionSchema,
  FlexGravitySchema,
  FlexHttpsUrlSchema,
  FlexJustifyContentSchema,
  FlexLayoutSchema,
  FlexLineSpacingSchema,
  FlexMarginValueSchema,
  FlexPositionSchema,
  FlexSizeValueSchema,
  FlexSpacingValueSchema,
  FlexStyleSchema,
  FlexTextSizeValueSchema,
  FlexWeightSchema,
} from './primitives'

// ============ Simple Components ============

export const FlexSpanSchema = v.object({
  type: v.literal('span'),
  text: v.string(),
  size: v.optional(FlexTextSizeValueSchema),
  color: v.optional(FlexColorSchema),
  weight: v.optional(FlexWeightSchema),
  style: v.optional(FlexStyleSchema),
  decoration: v.optional(FlexDecorationSchema),
})

export const FlexTextSchema = v.object({
  type: v.literal('text'),
  text: v.optional(v.string()),
  contents: v.optional(v.array(FlexSpanSchema)),
  flex: v.optional(v.number()),
  margin: v.optional(FlexMarginValueSchema),
  position: v.optional(FlexPositionSchema),
  offsetTop: v.optional(FlexDimensionSchema),
  offsetBottom: v.optional(FlexDimensionSchema),
  offsetStart: v.optional(FlexDimensionSchema),
  offsetEnd: v.optional(FlexDimensionSchema),
  size: v.optional(FlexTextSizeValueSchema),
  align: v.optional(FlexAlignSchema),
  gravity: v.optional(FlexGravitySchema),
  wrap: v.optional(v.boolean()),
  maxLines: v.optional(v.number()),
  weight: v.optional(FlexWeightSchema),
  color: v.optional(FlexColorSchema),
  style: v.optional(FlexStyleSchema),
  decoration: v.optional(FlexDecorationSchema),
  lineSpacing: v.optional(FlexLineSpacingSchema),
  action: v.optional(FlexActionSchema),
  adjustMode: v.optional(FlexAdjustModeSchema),
  scaling: v.optional(v.boolean()),
})

export const FlexButtonSchema = v.object({
  type: v.literal('button'),
  action: FlexActionSchema,
  flex: v.optional(v.number()),
  color: v.optional(FlexColorSchema),
  style: v.optional(FlexButtonStyleSchema),
  gravity: v.optional(FlexGravitySchema),
  margin: v.optional(FlexMarginValueSchema),
  position: v.optional(FlexPositionSchema),
  offsetTop: v.optional(FlexDimensionSchema),
  offsetBottom: v.optional(FlexDimensionSchema),
  offsetStart: v.optional(FlexDimensionSchema),
  offsetEnd: v.optional(FlexDimensionSchema),
  height: v.optional(FlexButtonHeightSchema),
  adjustMode: v.optional(FlexAdjustModeSchema),
  scaling: v.optional(v.boolean()),
})

export const FlexIconSchema = v.object({
  type: v.literal('icon'),
  url: FlexHttpsUrlSchema,
  size: v.optional(FlexSizeValueSchema),
  aspectRatio: v.optional(FlexAspectRatioSchema),
  margin: v.optional(FlexMarginValueSchema),
  position: v.optional(FlexPositionSchema),
  offsetTop: v.optional(FlexDimensionSchema),
  offsetBottom: v.optional(FlexDimensionSchema),
  offsetStart: v.optional(FlexDimensionSchema),
  offsetEnd: v.optional(FlexDimensionSchema),
  scaling: v.optional(v.boolean()),
})

export const FlexImageSchema = v.object({
  type: v.literal('image'),
  url: FlexHttpsUrlSchema,
  flex: v.optional(v.number()),
  margin: v.optional(FlexMarginValueSchema),
  position: v.optional(FlexPositionSchema),
  offsetTop: v.optional(FlexDimensionSchema),
  offsetBottom: v.optional(FlexDimensionSchema),
  offsetStart: v.optional(FlexDimensionSchema),
  offsetEnd: v.optional(FlexDimensionSchema),
  align: v.optional(FlexAlignSchema),
  gravity: v.optional(FlexGravitySchema),
  size: v.optional(FlexSizeValueSchema),
  aspectRatio: v.optional(FlexAspectRatioSchema),
  aspectMode: v.optional(FlexAspectModeSchema),
  backgroundColor: v.optional(FlexColorSchema),
  action: v.optional(FlexActionSchema),
})

export const FlexSeparatorSchema = v.object({
  type: v.literal('separator'),
  margin: v.optional(FlexMarginValueSchema),
  color: v.optional(FlexColorSchema),
})

export const FlexFillerSchema = v.object({
  type: v.literal('filler'),
  flex: v.optional(v.number()),
})

export const FlexSpacerSchema = v.object({
  type: v.literal('spacer'),
  size: v.optional(FlexSizeValueSchema),
})

// ============ Box (recursive — contains Components) ============

// Use v.lazy to break circular type inference between Box ↔ Component ↔ Video ↔ Box
export const FlexBoxSchema: v.LazySchema<v.ObjectSchema<v.ObjectEntries, undefined>> =
  v.lazy(() =>
    v.object({
      type: v.literal('box'),
      layout: FlexLayoutSchema,
      contents: v.array(v.lazy(() => FlexComponentSchema)),
      flex: v.optional(v.number()),
      spacing: v.optional(FlexSpacingValueSchema),
      margin: v.optional(FlexMarginValueSchema),
      paddingAll: v.optional(FlexDimensionSchema),
      paddingTop: v.optional(FlexDimensionSchema),
      paddingBottom: v.optional(FlexDimensionSchema),
      paddingStart: v.optional(FlexDimensionSchema),
      paddingEnd: v.optional(FlexDimensionSchema),
      position: v.optional(FlexPositionSchema),
      offsetTop: v.optional(FlexDimensionSchema),
      offsetBottom: v.optional(FlexDimensionSchema),
      offsetStart: v.optional(FlexDimensionSchema),
      offsetEnd: v.optional(FlexDimensionSchema),
      backgroundColor: v.optional(FlexColorSchema),
      borderColor: v.optional(FlexColorSchema),
      borderWidth: v.optional(FlexBorderWidthValueSchema),
      cornerRadius: v.optional(FlexCornerRadiusSchema),
      width: v.optional(FlexDimensionSchema),
      maxWidth: v.optional(FlexDimensionSchema),
      height: v.optional(FlexDimensionSchema),
      maxHeight: v.optional(FlexDimensionSchema),
      justifyContent: v.optional(FlexJustifyContentSchema),
      alignItems: v.optional(FlexAlignItemsSchema),
      background: v.optional(FlexBackgroundSchema),
      action: v.optional(FlexActionSchema),
    }),
  )

export const FlexVideoSchema: v.LazySchema<v.ObjectSchema<v.ObjectEntries, undefined>> =
  v.lazy(() =>
    v.object({
      type: v.literal('video'),
      url: FlexHttpsUrlSchema,
      previewUrl: FlexHttpsUrlSchema,
      altContent: v.optional(v.union([FlexImageSchema, FlexBoxSchema])),
      aspectRatio: v.optional(FlexAspectRatioSchema),
      action: v.optional(FlexActionSchema),
    }),
  )

// ============ Component Union ============

export const FlexComponentSchema: v.LazySchema<v.UnionSchema<v.UnionOptions, undefined>> =
  v.lazy(() =>
    v.union([
      FlexBoxSchema,
      FlexButtonSchema,
      FlexFillerSchema,
      FlexIconSchema,
      FlexImageSchema,
      FlexSeparatorSchema,
      FlexSpacerSchema,
      FlexTextSchema,
      FlexVideoSchema,
    ]),
  )
