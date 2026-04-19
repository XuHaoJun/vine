import { describe, expect, it } from 'vitest'
import * as v from 'valibot'
import { ImagemapAreaSchema } from './area'

describe('ImagemapAreaSchema', () => {
  it('accepts a valid area', () => {
    const r = v.safeParse(ImagemapAreaSchema, { x: 0, y: 0, width: 100, height: 50 })
    expect(r.success).toBe(true)
  })

  it('accepts zero-origin area', () => {
    const r = v.safeParse(ImagemapAreaSchema, { x: 0, y: 0, width: 1, height: 1 })
    expect(r.success).toBe(true)
  })

  it('rejects negative x', () => {
    expect(
      v.safeParse(ImagemapAreaSchema, { x: -1, y: 0, width: 1, height: 1 }).success,
    ).toBe(false)
  })

  it('rejects negative y', () => {
    expect(
      v.safeParse(ImagemapAreaSchema, { x: 0, y: -1, width: 1, height: 1 }).success,
    ).toBe(false)
  })

  it('rejects non-integer width', () => {
    expect(
      v.safeParse(ImagemapAreaSchema, { x: 0, y: 0, width: 10.5, height: 1 }).success,
    ).toBe(false)
  })

  it('rejects zero width', () => {
    expect(
      v.safeParse(ImagemapAreaSchema, { x: 0, y: 0, width: 0, height: 1 }).success,
    ).toBe(false)
  })

  it('rejects missing field', () => {
    expect(v.safeParse(ImagemapAreaSchema, { x: 0, y: 0, width: 10 }).success).toBe(false)
  })
})
