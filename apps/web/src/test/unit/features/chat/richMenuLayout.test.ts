import { describe, expect, it } from 'vitest'

import {
  getRichMenuDisplaySize,
  RICH_MENU_RESERVED_HEIGHT,
} from '~/features/chat/ui/richMenuLayout'

describe('getRichMenuDisplaySize', () => {
  it('uses the full viewport width when height still fits', () => {
    const size = getRichMenuDisplaySize({
      viewportWidth: 390,
      viewportHeight: 844,
      sizeWidth: 2500,
      sizeHeight: 1686,
    })

    expect(size.width).toBe(390)
    expect(size.height).toBeCloseTo(263, 0)
  })

  it('shrinks the rich menu on short viewports to keep the bottom bar reachable', () => {
    const viewportHeight = 531
    const size = getRichMenuDisplaySize({
      viewportWidth: 1024,
      viewportHeight,
      sizeWidth: 2500,
      sizeHeight: 1686,
    })

    expect(size.height).toBe(viewportHeight - RICH_MENU_RESERVED_HEIGHT)
    expect(size.width).toBeLessThan(1024)
  })
})
