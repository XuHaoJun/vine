import * as v from 'valibot'
import { FlexHttpsUrlSchema, FlexUrlSchema } from '@vine/line-schema-primitives'
import { ImagemapAreaSchema } from './area'

const ExternalLinkSchema = v.object({
  linkUri: FlexUrlSchema,
  label: v.pipe(v.string(), v.minLength(1), v.maxLength(30)),
})

export const ImagemapVideoSchema = v.object({
  originalContentUrl: FlexHttpsUrlSchema,
  previewImageUrl: FlexHttpsUrlSchema,
  area: ImagemapAreaSchema,
  externalLink: v.optional(ExternalLinkSchema),
})

export type ImagemapVideo = v.InferInput<typeof ImagemapVideoSchema>
