import { showToast } from '~/interface/toast/Toast'

declare const __DEV__: boolean

export type DateTimePickerAction = {
  mode: 'date' | 'time' | 'datetime'
  initial?: string
  min?: string
  max?: string
}

export type DateTimePickerResult =
  | { date: string }
  | { time: string }
  | { datetime: string }
  | null

export function openDateTimePicker(): Promise<DateTimePickerResult> {
  showToast('原生平台暫不支援日期選擇器', { type: 'info' })
  if (__DEV__) {
    console.warn('[openDateTimePicker] not implemented on native (v1 web-only)')
  }
  return Promise.resolve(null)
}
