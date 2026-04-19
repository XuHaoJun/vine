import { describe, expect, it, vi, beforeEach } from 'vitest'

vi.mock('react-native', () => ({
  Linking: { openURL: vi.fn() },
  Platform: { OS: 'web' },
}))
vi.mock('~/features/oa/dispatchPostback', () => ({
  dispatchPostback: vi.fn().mockResolvedValue({ success: true }),
}))
vi.mock('~/features/oa/openDateTimePicker', () => ({
  openDateTimePicker: vi.fn().mockResolvedValue(null),
}))
vi.mock('~/interface/toast/Toast', () => ({ showToast: vi.fn() }))

import { Linking } from 'react-native'
import { dispatchPostback } from '~/features/oa/dispatchPostback'
import { openDateTimePicker } from '~/features/oa/openDateTimePicker'
import { showToast } from '~/interface/toast/Toast'
import { dispatchAction } from '~/features/chat/useActionDispatcher'

const sendMessage = vi.fn()
const baseCtx = { chatId: 'c1', otherMemberOaId: 'oa1', sendMessage }

beforeEach(() => {
  vi.clearAllMocks()
})

describe('dispatchAction', () => {
  it('message → sendMessage', () => {
    dispatchAction(baseCtx, { type: 'message', text: 'hi' })
    expect(sendMessage).toHaveBeenCalledWith('hi')
  })

  it('uri → Linking.openURL', () => {
    dispatchAction(baseCtx, { type: 'uri', uri: 'https://x' })
    expect(Linking.openURL).toHaveBeenCalledWith('https://x')
  })

  it('postback → dispatchPostback + sendMessage for displayText', async () => {
    await dispatchAction(baseCtx, {
      type: 'postback',
      data: 'x=1',
      displayText: 'Buying',
    })
    expect(sendMessage).toHaveBeenCalledWith('Buying')
    expect(dispatchPostback).toHaveBeenCalledWith({
      oaId: 'oa1',
      chatId: 'c1',
      data: 'x=1',
    })
  })

  it('postback → toast on failure', async () => {
    ;(dispatchPostback as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      success: false,
      reason: 'HTTP 500',
    })
    await dispatchAction(baseCtx, { type: 'postback', data: 'x=1' })
    expect(showToast).toHaveBeenCalledWith('Postback 失敗：HTTP 500', { type: 'error' })
  })

  it('datetimepicker → opens picker then dispatches postback with params', async () => {
    ;(openDateTimePicker as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      datetime: '2026-04-19T12:00',
    })
    await dispatchAction(baseCtx, {
      type: 'datetimepicker',
      data: 'x=1',
      mode: 'datetime',
    })
    expect(dispatchPostback).toHaveBeenCalledWith({
      oaId: 'oa1',
      chatId: 'c1',
      data: 'x=1',
      params: { datetime: '2026-04-19T12:00' },
    })
  })

  it('datetimepicker → noops when user cancels (returns null)', async () => {
    ;(openDateTimePicker as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      null,
    )
    await dispatchAction(baseCtx, {
      type: 'datetimepicker',
      data: 'x=1',
      mode: 'date',
    })
    expect(dispatchPostback).not.toHaveBeenCalled()
  })

  it('clipboard → navigator.clipboard.writeText + toast', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(globalThis, 'navigator', {
      value: { clipboard: { writeText } },
      writable: true,
      configurable: true,
    })
    await dispatchAction(baseCtx, { type: 'clipboard', clipboardText: 'abc' })
    expect(writeText).toHaveBeenCalledWith('abc')
    expect(showToast).toHaveBeenCalledWith('已複製', { type: 'info' })
  })

  it('postback → noops when otherMemberOaId is null', async () => {
    await dispatchAction(
      { ...baseCtx, otherMemberOaId: null },
      { type: 'postback', data: 'x=1' },
    )
    expect(dispatchPostback).not.toHaveBeenCalled()
  })
})
