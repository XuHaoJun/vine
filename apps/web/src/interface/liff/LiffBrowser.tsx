import { memo, useRef, useEffect } from 'react'
import { YStack } from 'tamagui'

type ShareTargetPickerPayload = {
  type: 'liff:shareTargetPicker'
  messages: { type: string; text?: string }[]
  options: { isMultiple: boolean }
}

type LiffBrowserProps = {
  endpointUrl: string
  liffId: string
  accessToken?: string | undefined
  onClose?: (() => void) | undefined
  onMessage?: ((data: unknown) => void) | undefined
  onShareTargetPicker?: ((payload: ShareTargetPickerPayload) => void) | undefined
  height?: number | string
}

export const LiffBrowser = memo(
  ({
    endpointUrl,
    liffId,
    accessToken,
    onClose,
    onMessage,
    onShareTargetPicker,
    height = '100%',
  }: LiffBrowserProps) => {
    const iframeRef = useRef<HTMLIFrameElement>(null)

    const src = accessToken
      ? `${endpointUrl}${endpointUrl.includes('#') ? '&' : '#'}access_token=${encodeURIComponent(accessToken)}`
      : endpointUrl

    useEffect(() => {
      const handler = (event: MessageEvent) => {
        if (!event.data || typeof event.data !== 'object') return
        const msg = event.data as Record<string, unknown>
        if (msg['type'] === 'liff:closeWindow') {
          onClose?.()
        } else if (msg['type'] === 'liff:shareTargetPicker' && onShareTargetPicker) {
          onShareTargetPicker(event.data as ShareTargetPickerPayload)
        } else {
          onMessage?.(event.data)
        }
      }
      window.addEventListener('message', handler)
      return () => window.removeEventListener('message', handler)
    }, [onClose, onMessage, onShareTargetPicker])

    return (
      <YStack flex={1} style={{ height }}>
        <iframe
          ref={iframeRef}
          src={src}
          style={{ width: '100%', height: '100%', border: 'none' }}
          allow="camera; microphone"
          title={`LIFF App ${liffId}`}
        />
      </YStack>
    )
  },
)
