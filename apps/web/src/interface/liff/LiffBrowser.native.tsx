import { memo, useRef } from 'react'
import { YStack } from 'tamagui'
import { WebView, type WebViewMessageEvent } from 'react-native-webview'
import {
  createLiffIframeSrc,
  createLiffBootstrap,
  isAllowedLiffMessageOrigin,
  canSendMessages,
  LIFF_LINE_VERSION,
  type LiffRuntimeContext,
} from '~/features/liff/liffRuntime'
import { validateAndConvertLiffMessages } from '~/features/liff/liffMessage'
import { zero } from '~/zero/client'

type ShareTargetPickerPayload = {
  type: 'liff:shareTargetPicker'
  messages: { type: string; text?: string }[]
  options: { isMultiple: boolean }
}

type LiffBrowserProps = {
  endpointUrl: string
  liffId: string
  endpointOrigin: string
  apiBaseUrl: string
  chatId?: string
  contextType: 'utou' | 'group' | 'external'
  scopes: string[]
  accessToken?: string | undefined
  onClose?: (() => void) | undefined
  onMessage?: ((data: unknown) => void) | undefined
  onShareTargetPicker?: ((payload: ShareTargetPickerPayload) => void) | undefined
  height?: number | string
}

function buildInjectedJs(context: LiffRuntimeContext): string {
  const bootstrap = createLiffBootstrap(context)
  return `
(function() {
  window.VineLIFF = ${JSON.stringify(bootstrap)};
  true;
})();
`
}

export const LiffBrowser = memo(
  ({
    endpointUrl,
    liffId,
    endpointOrigin,
    apiBaseUrl,
    chatId,
    contextType,
    scopes,
    accessToken,
    onClose,
    onMessage,
    onShareTargetPicker,
  }: LiffBrowserProps) => {
    const context: LiffRuntimeContext = {
      apiBaseUrl,
      liffId,
      endpointUrl,
      endpointOrigin,
      accessToken,
      chatId,
      contextType,
      scopes,
      lineVersion: LIFF_LINE_VERSION,
    }

    const src = createLiffIframeSrc(context)
    const injectedJs = buildInjectedJs(context)
    const webViewRef = useRef<WebView>(null)

    const sendAckToWebview = (ack: Record<string, unknown>) => {
      webViewRef.current?.injectJavaScript(
        `window.dispatchEvent(new MessageEvent('message', { data: ${JSON.stringify(JSON.stringify(ack))} })); true;`,
      )
    }

    const handleMessage = (event: WebViewMessageEvent) => {
      const data = event.nativeEvent.data
      let parsed: Record<string, unknown>
      try {
        parsed = JSON.parse(data) as Record<string, unknown>
      } catch {
        onMessage?.(data)
        return
      }

      const type = parsed['type'] as string
      if (typeof type === 'string' && type.startsWith('liff:')) {
        const webViewOrigin = new URL(
          typeof event.nativeEvent.url === 'string' ? event.nativeEvent.url : endpointUrl,
        ).origin
        if (!isAllowedLiffMessageOrigin(webViewOrigin, endpointOrigin)) {
          return
        }
      }

      if (type === 'liff:closeWindow') {
        onClose?.()
      } else if (type === 'liff:shareTargetPicker' && onShareTargetPicker) {
        onShareTargetPicker(parsed as ShareTargetPickerPayload)
      } else if (type === 'liff:sendMessages') {
        const requestId = parsed['requestId'] as string
        const messages = parsed['messages'] as unknown[]

        const canResult = canSendMessages(context)
        if (!canResult.ok) {
          sendAckToWebview({
            type: 'liff:sendMessages:error',
            requestId,
            error: { code: 'PERMISSION_DENIED', message: canResult.error },
          })
          return
        }

        const validated = validateAndConvertLiffMessages({
          method: 'sendMessages',
          messages,
        })
        if (!validated.ok) {
          sendAckToWebview({
            type: 'liff:sendMessages:error',
            requestId,
            error: validated.error,
          })
          return
        }

        const now = Date.now()
        for (let i = 0; i < validated.messages.length; i++) {
          const converted = validated.messages[i]!
          zero.mutate.message.sendLiff({
            id: crypto.randomUUID(),
            chatId: chatId!,
            senderId: undefined,
            senderType: 'user',
            type: converted.type,
            text: converted.text ?? undefined,
            metadata: converted.metadata ?? undefined,
            createdAt: now + i,
          })
        }
      } else {
        onMessage?.(parsed)
      }
    }

    return (
      <YStack flex={1}>
        <WebView
          ref={webViewRef}
          source={{ uri: src }}
          injectedJavaScriptBeforeContentLoaded={injectedJs}
          onMessage={handleMessage}
          style={{ flex: 1 }}
          allowsInlineMediaPlayback
          mediaPlaybackRequiresUserAction={false}
        />
      </YStack>
    )
  },
)
