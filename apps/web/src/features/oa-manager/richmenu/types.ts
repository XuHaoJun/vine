import type { RichMenuAction } from '@vine/richmenu-schema'

export type { RichMenuAction }

export type AreaBounds = {
  x: number
  y: number
  w: number
  h: number
}

export type Area = {
  id: string
  bounds: AreaBounds
  action: RichMenuAction
}

export type MenuSize = '2500x1686' | '2500x843'

export type EditorState = {
  name: string
  size: MenuSize
  chatBarText: string
  selected: boolean
  areas: Area[]
  selectedAreaId: string | null
  imageDataUrl: string | null
  imageChanged: boolean
}

export function boundsToProto(b: AreaBounds) {
  return { x: b.x, y: b.y, width: b.w, height: b.h }
}

export function boundsFromProto(b: {
  x: number
  y: number
  width: number
  height: number
}): AreaBounds {
  return { x: b.x, y: b.y, w: b.width, h: b.height }
}
