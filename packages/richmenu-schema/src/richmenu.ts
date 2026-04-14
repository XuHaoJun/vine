import * as v from 'valibot'
import { RichMenuActionSchema } from './actions'

export const RichMenuSizeSchema = v.object({
  width: v.literal(2500),
  height: v.pipe(v.number(), v.minValue(1, 'height must be at least 1')),
})

export const RichMenuBoundsSchema = v.object({
  x: v.pipe(v.number(), v.minValue(0, 'x must be non-negative')),
  y: v.pipe(v.number(), v.minValue(0, 'y must be non-negative')),
  width: v.pipe(v.number(), v.minValue(1, 'width must be at least 1')),
  height: v.pipe(v.number(), v.minValue(1, 'height must be at least 1')),
})

export const RichMenuAreaSchema = v.object({
  bounds: RichMenuBoundsSchema,
  action: RichMenuActionSchema,
})

const NameSchema = v.pipe(
  v.string(),
  v.maxLength(30, 'name must be at most 30 characters'),
)

const ChatBarTextSchema = v.pipe(
  v.string(),
  v.maxLength(14, 'chatBarText must be at most 14 characters'),
)

const AreasSchema = v.pipe(
  v.array(RichMenuAreaSchema),
  v.maxLength(20, 'areas must have at most 20 items'),
)

export const RichMenuObjectSchema = v.object({
  size: RichMenuSizeSchema,
  selected: v.boolean(),
  name: NameSchema,
  chatBarText: ChatBarTextSchema,
  areas: AreasSchema,
})

export type RichMenuObject = v.InferInput<typeof RichMenuObjectSchema>
export type RichMenuArea = v.InferInput<typeof RichMenuAreaSchema>
export type RichMenuBounds = v.InferInput<typeof RichMenuBoundsSchema>
