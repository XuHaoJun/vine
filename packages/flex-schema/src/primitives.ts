import * as v from 'valibot'

// ============ Keyword Enums ============

export const FlexLayoutSchema = v.picklist(['horizontal', 'vertical', 'baseline'])

export const FlexGravitySchema = v.picklist(['top', 'bottom', 'center'])

export const FlexAlignSchema = v.picklist(['start', 'end', 'center'])

export const FlexPositionSchema = v.picklist(['relative', 'absolute'])

export const FlexDirectionSchema = v.picklist(['ltr', 'rtl'])

export const FlexWeightSchema = v.picklist(['regular', 'bold'])

export const FlexStyleSchema = v.picklist(['normal', 'italic'])

export const FlexDecorationSchema = v.picklist(['none', 'underline', 'line-through'])

export const FlexAspectModeSchema = v.picklist(['cover', 'fit'])

export const FlexAdjustModeSchema = v.picklist(['shrink-to-fit'])

export const FlexButtonStyleSchema = v.picklist(['link', 'primary', 'secondary'])

export const FlexButtonHeightSchema = v.picklist(['sm', 'md'])

// ============ Multi-value Enums ============

export const FlexSpacingSchema = v.picklist(['none', 'xs', 'sm', 'md', 'lg', 'xl', 'xxl'])

export const FlexMarginSchema = FlexSpacingSchema

export const FlexSizeSchema = v.picklist([
  'xxs',
  'xs',
  'sm',
  'md',
  'lg',
  'xl',
  'xxl',
  '3xl',
  '4xl',
  '5xl',
  'full',
])

export const FlexTextSizeSchema = v.picklist([
  'xxs',
  'xs',
  'sm',
  'md',
  'lg',
  'xl',
  'xxl',
  '3xl',
  '4xl',
  '5xl',
])

export const FlexBorderWidthSchema = v.picklist([
  'none',
  'light',
  'normal',
  'medium',
  'semi-bold',
  'bold',
])

export const FlexBubbleSizeSchema = v.picklist([
  'nano',
  'micro',
  'deca',
  'hecto',
  'kilo',
  'mega',
  'giga',
])

export const FlexAspectRatioSchema = v.picklist([
  '1:1',
  '1.51:1',
  '1.91:1',
  '4:3',
  '16:9',
  '20:13',
  '2:1',
  '3:1',
  '3:4',
  '9:16',
  '1:2',
  '1:3',
])

export const FlexJustifyContentSchema = v.picklist([
  'flex-start',
  'flex-end',
  'center',
  'space-between',
  'space-around',
  'space-evenly',
])

export const FlexAlignItemsSchema = v.picklist([
  'flex-start',
  'flex-end',
  'center',
  'baseline',
  'stretch',
])

// ============ Value Validators ============

export const FlexPixelSchema = v.pipe(
  v.string(),
  v.regex(/^\d+px$/, 'Must be a pixel value like "12px"'),
)

export const FlexColorSchema = v.pipe(
  v.string(),
  v.regex(
    /^#[0-9a-fA-F]{6}([0-9a-fA-F]{2})?$/,
    'Must be a hex color like "#RRGGBB" or "#RRGGBBAA"',
  ),
)

export { FlexHttpsUrlSchema, FlexUrlSchema } from '@vine/line-schema-primitives'

export const FlexAspectRatioValueSchema = v.pipe(
  v.string(),
  v.regex(/^\d{1,5}:\d{1,5}$/, 'Must be an aspect ratio like "16:9"'),
)

// ============ Dual-mode Validators ============

export const FlexKeywordOrPixelSchema = <T extends readonly string[]>(
  keywords: T,
  _label: string,
) => v.union([v.picklist(keywords), FlexPixelSchema])

export const FlexMarginValueSchema = v.union([FlexMarginSchema, FlexPixelSchema])

export const FlexSpacingValueSchema = v.union([FlexSpacingSchema, FlexPixelSchema])

export const FlexSizeValueSchema = v.union([FlexSizeSchema, FlexPixelSchema])

export const FlexTextSizeValueSchema = v.union([FlexTextSizeSchema, FlexPixelSchema])

export const FlexCornerRadiusSchema = v.union([FlexSpacingSchema, FlexPixelSchema])

export const FlexDimensionSchema = FlexPixelSchema

export const FlexBorderWidthValueSchema = v.union([
  FlexBorderWidthSchema,
  FlexPixelSchema,
])

export const FlexLineSpacingSchema = FlexPixelSchema

// ============ Background ============

export const FlexBackgroundSchema = v.object({
  type: v.literal('linearGradient'),
  angle: v.optional(v.string()),
  startColor: v.optional(FlexColorSchema),
  endColor: v.optional(FlexColorSchema),
  centerColor: v.optional(FlexColorSchema),
  centerPosition: v.optional(FlexPixelSchema),
})
