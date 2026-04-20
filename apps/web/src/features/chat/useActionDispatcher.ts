import { useCallback } from 'react'
import { Linking, Platform } from 'react-native'
import { dispatchPostback } from '~/features/oa/dispatchPostback'
import { openDateTimePicker } from '~/features/oa/openDateTimePicker'
import { showToast } from '~/interface/toast/Toast'

export type DispatchableAction =
  | { type: 'message'; label?: string; text: string }
  | { type: 'uri'; label?: string; uri: string }
  | {
      type: 'postback'
      label?: string
      data: string
      displayText?: string
    }
  | {
      type: 'datetimepicker'
      label?: string
      data: string
      mode: 'date' | 'time' | 'datetime'
      initial?: string
      max?: string
      min?: string
    }
  | { type: 'clipboard'; label?: string; clipboardText: string }

export type ActionDispatcherContext = {
  chatId: string
  otherMemberOaId: string | null
  sendMessage: (text: string) => void
}

export function dispatchAction(
  ctx: ActionDispatcherContext,
  action: DispatchableAction,
): void | Promise<void> {
  const { chatId, otherMemberOaId, sendMessage } = ctx
  switch (action.type) {
    case 'message':
      sendMessage(action.text)
      return
    case 'uri':
      Linking.openURL(action.uri)
      return
    case 'postback': {
      if (!otherMemberOaId) return
      if (action.displayText) sendMessage(action.displayText)
      return dispatchPostback({
        oaId: otherMemberOaId,
        chatId,
        data: action.data,
      }).then((res) => {
        if (!res.success) {
          showToast(`Postback 失敗：${res.reason ?? 'unknown'}`, { type: 'error' })
        }
      })
    }
    case 'datetimepicker': {
      if (!otherMemberOaId) return
      return openDateTimePicker(action).then((params) => {
        if (!params) return
        return dispatchPostback({
          oaId: otherMemberOaId,
          chatId,
          data: action.data,
          params,
        }).then((res) => {
          if (!res.success) {
            showToast(`Postback 失敗：${res.reason ?? 'unknown'}`, { type: 'error' })
          }
        })
      })
    }
    case 'clipboard': {
      if (Platform.OS !== 'web' || typeof navigator === 'undefined') {
        showToast('複製功能尚未支援', { type: 'info' })
        return
      }
      return navigator.clipboard
        .writeText(action.clipboardText)
        .then(() => showToast('已複製', { type: 'info' }))
        .catch(() => showToast('複製失敗', { type: 'error' }))
    }
  }
}

export function useActionDispatcher(ctx: ActionDispatcherContext) {
  const { chatId, otherMemberOaId, sendMessage } = ctx
  return useCallback(
    (action: DispatchableAction) => dispatchAction(ctx, action),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [chatId, otherMemberOaId, sendMessage],
  )
}
