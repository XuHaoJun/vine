import { describe, expect, it, vi } from 'vitest'
import type { LFexAction } from '../types'
import { handleAction } from './action'

describe('action utilities', () => {
  it('calls onAction with the action when provided', () => {
    const onAction = vi.fn()
    const action: LFexAction = { type: 'uri', uri: 'https://line.me/' }
    const handler = handleAction(action, onAction)
    handler?.({} as any)
    expect(onAction).toHaveBeenCalledWith(action)
  })

  it('returns undefined when no action', () => {
    const handler = handleAction(undefined, undefined)
    expect(handler).toBeUndefined()
  })

  it('returns undefined when no onAction handler', () => {
    const action: LFexAction = { type: 'message', text: 'hello' }
    const handler = handleAction(action, undefined)
    expect(handler).toBeUndefined()
  })
})
