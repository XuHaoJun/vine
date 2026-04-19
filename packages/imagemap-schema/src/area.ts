import * as v from 'valibot'

const NonNegativeInteger = v.pipe(v.number(), v.integer(), v.minValue(0))
const PositiveInteger = v.pipe(v.number(), v.integer(), v.minValue(1))

export const ImagemapAreaSchema = v.object({
  x: NonNegativeInteger,
  y: NonNegativeInteger,
  width: PositiveInteger,
  height: PositiveInteger,
})

export type ImagemapArea = v.InferInput<typeof ImagemapAreaSchema>
