export const RICH_MENU_RESERVED_HEIGHT = 160

type GetRichMenuDisplaySizeParams = {
  viewportWidth: number
  viewportHeight: number
  sizeWidth: number
  sizeHeight: number
}

type RichMenuDisplaySize = {
  width: number
  height: number
}

export function getRichMenuDisplaySize({
  viewportWidth,
  viewportHeight,
  sizeWidth,
  sizeHeight,
}: GetRichMenuDisplaySizeParams): RichMenuDisplaySize {
  const safeViewportWidth = Math.max(viewportWidth, 1)
  const safeViewportHeight = Math.max(viewportHeight, 1)
  const aspectRatio = sizeWidth / sizeHeight
  const maxHeight = Math.max(safeViewportHeight - RICH_MENU_RESERVED_HEIGHT, 1)
  const heightAtFullWidth = safeViewportWidth / aspectRatio

  if (heightAtFullWidth <= maxHeight) {
    return {
      width: safeViewportWidth,
      height: heightAtFullWidth,
    }
  }

  return {
    width: maxHeight * aspectRatio,
    height: maxHeight,
  }
}
