import type { AreaBounds } from './types'

export type Template = {
  label: string
  bounds: AreaBounds[]
}

export const TEMPLATES: Record<string, Template[]> = {
  '2500x1686': [
    {
      label: '1 area',
      bounds: [{ x: 0, y: 0, w: 2500, h: 1686 }],
    },
    {
      label: '2 areas (wide + narrow)',
      bounds: [
        { x: 0, y: 0, w: 1666, h: 1686 },
        { x: 1667, y: 0, w: 833, h: 1686 },
      ],
    },
    {
      label: '2 areas (top + bottom)',
      bounds: [
        { x: 0, y: 0, w: 2500, h: 843 },
        { x: 0, y: 843, w: 2500, h: 843 },
      ],
    },
    {
      label: '2 areas (equal halves)',
      bounds: [
        { x: 0, y: 0, w: 1250, h: 1686 },
        { x: 1250, y: 0, w: 1250, h: 1686 },
      ],
    },
    {
      label: '3 areas (left + 2 right)',
      bounds: [
        { x: 0, y: 0, w: 1666, h: 1686 },
        { x: 1667, y: 0, w: 833, h: 843 },
        { x: 1667, y: 844, w: 833, h: 843 },
      ],
    },
    {
      label: '3 areas (left + 2 right, equal)',
      bounds: [
        { x: 0, y: 0, w: 1250, h: 1686 },
        { x: 1250, y: 0, w: 1250, h: 843 },
        { x: 1250, y: 844, w: 1250, h: 843 },
      ],
    },
    {
      label: '3 areas (equal thirds)',
      bounds: [
        { x: 0, y: 0, w: 833, h: 1686 },
        { x: 833, y: 0, w: 833, h: 1686 },
        { x: 1666, y: 0, w: 833, h: 1686 },
      ],
    },
    {
      label: '4 areas (1 top + 3 bottom)',
      bounds: [
        { x: 0, y: 0, w: 2500, h: 843 },
        { x: 0, y: 843, w: 833, h: 843 },
        { x: 833, y: 843, w: 833, h: 843 },
        { x: 1666, y: 843, w: 833, h: 843 },
      ],
    },
    {
      label: '4 areas (2×2 grid)',
      bounds: [
        { x: 0, y: 0, w: 1250, h: 843 },
        { x: 1250, y: 0, w: 1250, h: 843 },
        { x: 0, y: 843, w: 1250, h: 843 },
        { x: 1250, y: 843, w: 1250, h: 843 },
      ],
    },
    {
      label: '6 areas (2×3 grid)',
      bounds: [
        { x: 0, y: 0, w: 833, h: 843 },
        { x: 833, y: 0, w: 833, h: 843 },
        { x: 1666, y: 0, w: 833, h: 843 },
        { x: 0, y: 843, w: 833, h: 843 },
        { x: 833, y: 843, w: 833, h: 843 },
        { x: 1666, y: 843, w: 833, h: 843 },
      ],
    },
  ],
  '2500x843': [
    {
      label: '1 area',
      bounds: [{ x: 0, y: 0, w: 2500, h: 843 }],
    },
    {
      label: '2 areas (equal halves)',
      bounds: [
        { x: 0, y: 0, w: 1250, h: 843 },
        { x: 1250, y: 0, w: 1250, h: 843 },
      ],
    },
    {
      label: '2 areas (narrow + wide)',
      bounds: [
        { x: 0, y: 0, w: 833, h: 843 },
        { x: 833, y: 0, w: 1666, h: 843 },
      ],
    },
    {
      label: '2 areas (wide + narrow)',
      bounds: [
        { x: 0, y: 0, w: 1666, h: 843 },
        { x: 1666, y: 0, w: 833, h: 843 },
      ],
    },
    {
      label: '3 areas (equal thirds)',
      bounds: [
        { x: 0, y: 0, w: 833, h: 843 },
        { x: 833, y: 0, w: 833, h: 843 },
        { x: 1666, y: 0, w: 833, h: 843 },
      ],
    },
  ],
}
