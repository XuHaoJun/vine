import { describe, expect, it } from 'vitest'
import { getRichMessageToolbarItems } from '~/features/rich-message/RichMessageToolbar'
import { RichMessageStarterKit } from '~/features/rich-message/RichMessageStarterKit'

describe('getRichMessageToolbarItems', () => {
  it('projects enabled extension buttons and count label without default limit', () => {
    const items = getRichMessageToolbarItems({
      extensions: RichMessageStarterKit.configure(),
      canInsert: (type) => type !== 'imagemap' && type !== 'sticker' && type !== 'location',
      count: 2,
      maxMessages: undefined,
    })

    expect(items.countLabel).toBe('2 messages')
    expect(items.buttons.find((button) => button.type === 'text')).toMatchObject({
      ariaLabel: 'Add text message',
      disabled: false,
    })
    expect(items.buttons.find((button) => button.type === 'sticker')).toMatchObject({
      ariaLabel: 'Add sticker message',
      disabled: true,
    })
    expect(items.buttons.find((button) => button.type === 'imagemap')).toMatchObject({
      ariaLabel: 'Add imagemap message',
      disabled: true,
    })
  })

  it('uses bounded count labels only when maxMessages is provided', () => {
    const items = getRichMessageToolbarItems({
      extensions: RichMessageStarterKit.configure({ text: true, mediaUrl: false, flex: false, imagemap: false }),
      canInsert: () => false,
      count: 1,
      maxMessages: 1,
    })

    expect(items.countLabel).toBe('1 / 1')
    expect(items.buttons[0]).toMatchObject({ type: 'text', disabled: true })
  })
})
