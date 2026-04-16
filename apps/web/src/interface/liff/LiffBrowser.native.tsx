import { memo } from 'react'
import { YStack } from 'tamagui'
import { WebView } from 'react-native-webview'

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

const INJECTED_JS = `
(function() {
  window.VineLIFF = {
    lineVersion: '14.0.0',
    platform: 'native',
  };
  true;
})();
`

export const LiffBrowser = memo(
  ({
    endpointUrl,
    liffId,
    accessToken,
    onClose,
    onMessage,
    onShareTargetPicker,
  }: LiffBrowserProps) => {
    const src = accessToken
      ? `${endpointUrl}${endpointUrl.includes('#') ? '&' : '#'}access_token=${encodeURIComponent(accessToken)}`
      : endpointUrl

    return (
      <YStack flex={1}>
        <WebView
          source={{ uri: src }}
          injectedJavaScriptBeforeContentLoaded={INJECTED_JS}
          onMessage={(event) => {
            const data = event.nativeEvent.data
            try {
              const parsed = JSON.parse(data) as Record<string, unknown>
              if (parsed['type'] === 'liff:closeWindow') {
                onClose?.()
              } else if (
                parsed['type'] === 'liff:shareTargetPicker' &&
                onShareTargetPicker
              ) {
                onShareTargetPicker(parsed as ShareTargetPickerPayload)
              } else {
                onMessage?.(parsed)
              }
            } catch {
              onMessage?.(data)
            }
          }}
          style={{ flex: 1 }}
          allowsInlineMediaPlayback
          mediaPlaybackRequiresUserAction={false}
        />
      </YStack>
    )
  },
)
