import * as v from 'valibot'
import { RichMenuActionSchema } from './actions'

const SupportedRichMenuSizeSchema = v.union([
  v.object({ width: v.literal(2500), height: v.literal(1686) }),
  v.object({ width: v.literal(2500), height: v.literal(843) }),
])

export const RichMenuSizeSchema = v.pipe(
  SupportedRichMenuSizeSchema,
  v.description('Vine supports LINE rich menu sizes 2500x1686 and 2500x843'),
)

export const RichMenuBoundsSchema = v.object({
  x: v.pipe(v.number(), v.integer(), v.minValue(0, 'x must be non-negative')),
  y: v.pipe(v.number(), v.integer(), v.minValue(0, 'y must be non-negative')),
  width: v.pipe(v.number(), v.integer(), v.minValue(1, 'width must be at least 1')),
  height: v.pipe(v.number(), v.integer(), v.minValue(1, 'height must be at least 1')),
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

export const RichMenuObjectSchema = v.pipe(
  v.object({
    size: RichMenuSizeSchema,
    selected: v.boolean(),
    name: NameSchema,
    chatBarText: ChatBarTextSchema,
    areas: AreasSchema,
  }),
  v.check((menu) => {
    return menu.areas.every((area) => {
      const right = area.bounds.x + area.bounds.width
      const bottom = area.bounds.y + area.bounds.height
      return right <= menu.size.width && bottom <= menu.size.height
    })
  }, 'areas must stay within rich menu bounds'),
)

export type RichMenuObject = v.InferInput<typeof RichMenuObjectSchema>
export type RichMenuArea = v.InferInput<typeof RichMenuAreaSchema>
export type RichMenuBounds = v.InferInput<typeof RichMenuBoundsSchema>
