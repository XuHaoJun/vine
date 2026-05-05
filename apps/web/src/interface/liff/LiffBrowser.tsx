import { memo, useRef, useEffect, useMemo, type MutableRefObject } from 'react'
import { YStack } from 'tamagui'
import {
  createLiffIframeSrc,
  createLiffBootstrap,
  isAllowedLiffMessageOrigin,
  canSendMessages,
  LIFF_LINE_VERSION,
  type LiffRuntimeContext,
} from '~/features/liff/liffRuntimeHelpers'
import { validateAndConvertLiffMessages } from '~/features/liff/liffMessage'
import { zero } from '~/zero/client'

type ShareTargetPickerPayload = {
  type: 'liff:shareTargetPicker'
  messages: { type: string; text?: string }[]
  options: { isMultiple: boolean }
}

type MiniAppMeta = {
  id: string
  name: string
  iconUrl: string | null
  description: string | null
  category: string | null
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
  miniApp?: MiniAppMeta | undefined
  forwardPath?: string | undefined
  onLoad?: (() => void) | undefined
  onIframeRef?: ((ref: HTMLIFrameElement | null) => void) | undefined
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
    miniApp,
    forwardPath,
    onLoad,
    onIframeRef,
  }: LiffBrowserProps) => {
    const iframeRef = useRef<HTMLIFrameElement>(null)
    const onCloseRef = useRef(onClose)
    const onMessageRef = useRef(onMessage)
    const onShareTargetPickerRef = useRef(onShareTargetPicker)
    const onLoadRef = useRef(onLoad)
    const onIframeRefCb = onIframeRef
    onCloseRef.current = onClose
    onMessageRef.current = onMessage
    onShareTargetPickerRef.current = onShareTargetPicker
    onLoadRef.current = onLoad

    const context = useMemo<LiffRuntimeContext>(
      () => ({
        apiBaseUrl,
        liffId,
        endpointUrl,
        endpointOrigin,
        accessToken,
        chatId,
        contextType,
        scopes,
        lineVersion: LIFF_LINE_VERSION,
      }),
      [
        apiBaseUrl,
        liffId,
        endpointUrl,
        endpointOrigin,
        accessToken,
        chatId,
        contextType,
        scopes,
      ],
    )

    const src = useMemo(() => {
      const base = createLiffIframeSrc(context)
      if (forwardPath) {
        try {
          const url = new URL(base)
          // Append forwardPath as liff.state query param so LIFF runtime can restore navigation
          url.searchParams.set('liff.state', forwardPath)
          return url.toString()
        } catch {
          return base
        }
      }
      return base
    }, [context, forwardPath])

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
          const enrichedBootstrap = miniApp
            ? { ...bootstrap, miniAppId: miniApp.id, miniApp }
            : bootstrap
          iframeRef.current?.contentWindow?.postMessage(
            { type: 'liff:bootstrap:done', requestId, bootstrap: enrichedBootstrap },
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

          const sendAck = (ack: Record<string, unknown>) => {
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
            const converted = validated.messages[i]!
            zero.mutate.message.sendLiff({
              id: crypto.randomUUID(),
              chatId: context.chatId!,
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
    }, [context, endpointOrigin])

    return (
      <YStack flex={1} style={{ height }}>
        <iframe
          ref={(el) => {
            ;(iframeRef as MutableRefObject<HTMLIFrameElement | null>).current = el
            onIframeRefCb?.(el)
          }}
          id="liff-browser-iframe"
          src={src}
          style={{ width: '100%', height: '100%', border: 'none' }}
          allow="camera; microphone"
          sandbox="allow-scripts allow-same-origin"
          title={`LIFF App ${liffId}`}
          onLoad={() => onLoadRef.current?.()}
        />
      </YStack>
    )
  },
)
