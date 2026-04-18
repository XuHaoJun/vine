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
    const onCloseRef = useRef(onClose)
    const onMessageRef = useRef(onMessage)
    const onShareTargetPickerRef = useRef(onShareTargetPicker)
    onCloseRef.current = onClose
    onMessageRef.current = onMessage
    onShareTargetPickerRef.current = onShareTargetPicker

    const src = accessToken
      ? `${endpointUrl}${endpointUrl.includes('#') ? '&' : '#'}access_token=${encodeURIComponent(accessToken)}`
      : endpointUrl

    useEffect(() => {
      const handler = (event: MessageEvent) => {
        if (!event.data || typeof event.data !== 'object') return
        const msg = event.data as Record<string, unknown>
        if (msg['type'] === 'liff:closeWindow') {
          onCloseRef.current?.()
        } else if (msg['type'] === 'liff:shareTargetPicker') {
          onShareTargetPickerRef.current?.(event.data as ShareTargetPickerPayload)
        } else {
          onMessageRef.current?.(event.data)
        }
      }
      window.addEventListener('message', handler)
      return () => window.removeEventListener('message', handler)
    }, [])

    return (
      <YStack flex={1} style={{ height }}>
        <iframe
          ref={iframeRef}
          id="liff-browser-iframe"
          src={src}
          style={{ width: '100%', height: '100%', border: 'none' }}
          allow="camera; microphone"
          sandbox="allow-scripts"
          title={`LIFF App ${liffId}`}
        />
      </YStack>
    )
  },
)
