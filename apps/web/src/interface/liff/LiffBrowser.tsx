import { memo, useRef, useEffect } from 'react'
import { YStack } from 'tamagui'
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
    height = '100%',
  }: LiffBrowserProps) => {
    const iframeRef = useRef<HTMLIFrameElement>(null)
    const onCloseRef = useRef(onClose)
    const onMessageRef = useRef(onMessage)
    const onShareTargetPickerRef = useRef(onShareTargetPicker)
    onCloseRef.current = onClose
    onMessageRef.current = onMessage
    onShareTargetPickerRef.current = onShareTargetPicker

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

    useEffect(() => {
      const handler = (event: MessageEvent) => {
        if (!event.data || typeof event.data !== 'object') return
        const msg = event.data as Record<string, unknown>
        const type = msg['type'] as string

        if (typeof type === 'string' && type.startsWith('liff:')) {
          if (!isAllowedLiffMessageOrigin(event.origin, endpointOrigin)) {
            return
          }
        }

        if (type === 'liff:bootstrap') {
          const requestId = msg['requestId'] as string
          const bootstrap = createLiffBootstrap(context)
          iframeRef.current?.contentWindow?.postMessage(
            { type: 'liff:bootstrap:done', requestId, bootstrap },
            endpointOrigin,
          )
          return
        }

        if (type === 'liff:closeWindow') {
          onCloseRef.current?.()
          return
        }

        if (type === 'liff:shareTargetPicker') {
          onShareTargetPickerRef.current?.(event.data as ShareTargetPickerPayload)
          return
        }

        if (type === 'liff:sendMessages') {
          const requestId = msg['requestId'] as string
          const messages = msg['messages'] as unknown[]

          const sendAck = (
            ack: Record<string, unknown>,
          ) => {
            iframeRef.current?.contentWindow?.postMessage(ack, endpointOrigin)
          }

          const canResult = canSendMessages(context)
          if (!canResult.ok) {
            sendAck({
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
            sendAck({
              type: 'liff:sendMessages:error',
              requestId,
              error: validated.error,
            })
            return
          }

          const now = Date.now()
          for (let i = 0; i < validated.messages.length; i++) {
            const converted = validated.messages[i]
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

          sendAck({ type: 'liff:sendMessages:done', requestId })
          return
        }

        onMessageRef.current?.(event.data)
      }
      window.addEventListener('message', handler)
      return () => window.removeEventListener('message', handler)
    }, [endpointOrigin, apiBaseUrl, liffId, chatId, contextType, scopes, accessToken, endpointUrl])

    return (
      <YStack flex={1} style={{ height }}>
        <iframe
          ref={iframeRef}
          id="liff-browser-iframe"
          src={src}
          style={{ width: '100%', height: '100%', border: 'none' }}
          allow="camera; microphone"
          sandbox="allow-scripts allow-same-origin"
          title={`LIFF App ${liffId}`}
        />
      </YStack>
    )
  },
)
