import * as v from 'valibot'
import { FlexUrlSchema } from '@vine/line-schema-primitives'
import { ImagemapAreaSchema } from './area'

export const ImagemapUriActionSchema = v.object({
  type: v.literal('uri'),
  label: v.optional(v.pipe(v.string(), v.maxLength(100))),
  linkUri: FlexUrlSchema,
  area: ImagemapAreaSchema,
})

export const ImagemapMessageActionSchema = v.object({
  type: v.literal('message'),
  label: v.optional(v.pipe(v.string(), v.maxLength(100))),
  text: v.pipe(v.string(), v.minLength(1), v.maxLength(400)),
  area: ImagemapAreaSchema,
})

export const ImagemapClipboardActionSchema = v.object({
  type: v.literal('clipboard'),
  label: v.optional(v.pipe(v.string(), v.maxLength(100))),
  clipboardText: v.pipe(v.string(), v.minLength(1), v.maxLength(1000)),
  area: ImagemapAreaSchema,
})

export const ImagemapActionSchema = v.union([
  ImagemapUriActionSchema,
  ImagemapMessageActionSchema,
  ImagemapClipboardActionSchema,
])

export type ImagemapAction = v.InferInput<typeof ImagemapActionSchema>
