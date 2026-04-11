import * as v from 'valibot'
import { FlexActionSchema } from './action'
import {
  FlexBackgroundSchema,
  FlexBubbleSizeSchema,
  FlexColorSchema,
  FlexDirectionSchema,
} from './primitives'
import { FlexBoxSchema, FlexImageSchema, FlexVideoSchema } from './components'

// ============ Block Styles ============

export const FlexBlockStyleSchema = v.object({
  backgroundColor: v.optional(FlexColorSchema),
  separator: v.optional(v.boolean()),
  separatorColor: v.optional(FlexColorSchema),
})

export const FlexBubbleStylesSchema = v.object({
  header: v.optional(FlexBlockStyleSchema),
  hero: v.optional(FlexBlockStyleSchema),
  body: v.optional(FlexBlockStyleSchema),
  footer: v.optional(FlexBlockStyleSchema),
})

// ============ Bubble ============

export const FlexHeroSchema = v.lazy(() =>
  v.union([FlexImageSchema, FlexBoxSchema, FlexVideoSchema]),
)

export const FlexBubbleSchema = v.object({
  type: v.literal('bubble'),
  size: v.optional(FlexBubbleSizeSchema),
  direction: v.optional(FlexDirectionSchema),
  header: v.optional(v.lazy(() => FlexBoxSchema)),
  hero: v.optional(FlexHeroSchema),
  body: v.optional(v.lazy(() => FlexBoxSchema)),
  footer: v.optional(v.lazy(() => FlexBoxSchema)),
  styles: v.optional(FlexBubbleStylesSchema),
  action: v.optional(FlexActionSchema),
})

// ============ Carousel ============

export const FlexCarouselSchema = v.object({
  type: v.literal('carousel'),
  contents: v.array(FlexBubbleSchema),
})

// ============ Container Union ============

export const FlexContainerSchema = v.union([FlexBubbleSchema, FlexCarouselSchema])

// ============ Flex Message ============

export const FlexMessageSchema = v.object({
  type: v.literal('flex'),
  altText: v.string(),
  contents: FlexContainerSchema,
})
