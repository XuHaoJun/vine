import { describe, expect, it, vi } from 'vitest'
import { createRichMessageEditor } from '~/features/rich-message/core/editor'
import { RichMessageStarterKit } from '~/features/rich-message/RichMessageStarterKit'

describe('rich message editor core', () => {
  it('inserts drafts through extension commands without a default maxMessages limit', () => {
    const onChange = vi.fn()
    const editor = createRichMessageEditor({
      value: [],
      onChange,
      extensions: RichMessageStarterKit.configure({ text: true, mediaUrl: true }),
    })

    expect(editor.can().insertMessage('text')).toBe(true)
    expect(editor.commands.insertMessage('text')).toBe(true)
    expect(onChange.mock.calls[0]![0]![0]).toMatchObject({ type: 'text' })
  })

  it('enforces maxMessages only when provided', () => {
    const editor = createRichMessageEditor({
      value: [{ id: 'msg-1', type: 'text', text: 'one' }],
      onChange: vi.fn(),
      maxMessages: 1,
      extensions: RichMessageStarterKit.configure({ text: true }),
    })

    expect(editor.can().insertMessage('text')).toBe(false)
    expect(editor.commands.insertMessage('text')).toBe(false)
  })

  it('rejects duplicate extension types', () => {
    const ext = RichMessageStarterKit.configure({ text: true })[0]!

    expect(() =>
      createRichMessageEditor({
        value: [],
        onChange: vi.fn(),
        extensions: [ext, ext],
      }),
    ).toThrow('Duplicate rich message extension type: text')
  })
})
