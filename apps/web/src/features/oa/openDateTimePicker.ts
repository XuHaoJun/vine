import { showToast } from '~/interface/toast/Toast'

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

const MODE_TO_INPUT: Record<DateTimePickerAction['mode'], string> = {
  date: 'date',
  time: 'time',
  datetime: 'datetime-local',
}

export function openDateTimePicker(
  action: DateTimePickerAction,
): Promise<DateTimePickerResult> {
  if (typeof document === 'undefined') {
    if (process.env['NODE_ENV'] !== 'production') {
      console.warn('[openDateTimePicker] no document — datetime picker unavailable')
    }
    return Promise.resolve(null)
  }

  return new Promise((resolve) => {
    const input = document.createElement('input')
    input.type = MODE_TO_INPUT[action.mode]
    input.style.position = 'fixed'
    input.style.left = '-9999px'
    if (action.initial) input.value = action.initial
    if (action.min) input.min = action.min
    if (action.max) input.max = action.max
    document.body.appendChild(input)

    let settled = false
    const cleanup = () => {
      if (input.parentNode) input.parentNode.removeChild(input)
    }
    const finish = (value: DateTimePickerResult) => {
      if (settled) return
      settled = true
      cleanup()
      resolve(value)
    }

    input.addEventListener('change', () => {
      const v = input.value
      if (!v) return finish(null)
      switch (action.mode) {
        case 'date':
          return finish({ date: v })
        case 'time':
          return finish({ time: v })
        case 'datetime':
          return finish({ datetime: v })
      }
    })
    // 'cancel' fires on Chromium/Firefox; on Safari we rely on blur as a fallback.
    input.addEventListener('cancel', () => finish(null))
    input.addEventListener('blur', () => {
      // Defer a tick so 'change' wins if both fired.
      setTimeout(() => finish(null), 0)
    })

    try {
      if (typeof (input as HTMLInputElement).showPicker === 'function') {
        ;(input as HTMLInputElement).showPicker()
      } else {
        input.click()
      }
    } catch (err) {
      if (process.env['NODE_ENV'] !== 'production') {
        console.warn('[openDateTimePicker] showPicker failed', err)
      }
      showToast('無法開啟日期選擇器', { type: 'error' })
      finish(null)
    }
  })
}
