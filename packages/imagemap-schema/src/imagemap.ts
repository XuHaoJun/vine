import * as v from 'valibot'
import { FlexHttpsUrlSchema } from '@vine/line-schema-primitives'
import { ImagemapActionSchema, type ImagemapAction } from './action'
import { ImagemapVideoSchema, type ImagemapVideo } from './video'

// LINE spec: baseUrl must not include image extension (images are served
// at baseUrl/{width} with no extension).
const NoImageExtension = v.check((url: string) => {
  const lower = url.toLowerCase()
  return !(
    lower.endsWith('.jpg') ||
    lower.endsWith('.jpeg') ||
    lower.endsWith('.png') ||
    lower.endsWith('.gif') ||
    lower.endsWith('.webp')
  )
}, 'baseUrl must not include a file extension')

const BaseUrlSchema = v.pipe(
  v.string(),
  v.url(),
  v.startsWith('https://', 'Must use HTTPS'),
  NoImageExtension,
)

// LINE spec: width is fixed at 1040; only height varies.
const ImagemapBaseSizeSchema = v.object({
  width: v.literal(1040),
  height: v.pipe(v.number(), v.integer(), v.minValue(1)),
})

type ImagemapBaseSize = v.InferInput<typeof ImagemapBaseSizeSchema>

function areaFits(
  area: { x: number; y: number; width: number; height: number },
  baseSize: ImagemapBaseSize,
): boolean {
  return area.x + area.width <= baseSize.width && area.y + area.height <= baseSize.height
}

const ImagemapMessageShape = v.object({
  type: v.literal('imagemap'),
  baseUrl: BaseUrlSchema,
  altText: v.pipe(v.string(), v.minLength(1), v.maxLength(1500)),
  baseSize: ImagemapBaseSizeSchema,
  video: v.optional(ImagemapVideoSchema),
  actions: v.pipe(v.array(ImagemapActionSchema), v.minLength(1), v.maxLength(50)),
})

export const ImagemapMessageSchema = v.pipe(
  ImagemapMessageShape,
  v.check((msg) => {
    for (const a of msg.actions) {
      if (!areaFits(a.area, msg.baseSize)) return false
    }
    if (msg.video && !areaFits(msg.video.area, msg.baseSize)) return false
    return true
  }, 'action.area or video.area exceeds baseSize bounds'),
)

export type ImagemapMessage = v.InferInput<typeof ImagemapMessageSchema>
export type { ImagemapAction, ImagemapVideo }
