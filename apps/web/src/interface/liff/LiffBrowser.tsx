import { memo, useRef, useEffect } from 'react'
import { YStack } from 'tamagui'

type LiffBrowserProps = {
  endpointUrl: string
  liffId: string
  accessToken?: string | undefined
  onClose?: (() => void) | undefined
  onMessage?: ((data: unknown) => void) | undefined
  height?: number | string
}

export const LiffBrowser = memo(
  ({
    endpointUrl,
    liffId,
    accessToken,
    onClose,
    onMessage,
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
        } else {
          onMessage?.(event.data)
        }
      }
      window.addEventListener('message', handler)
      return () => window.removeEventListener('message', handler)
    }, [onClose, onMessage])

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
