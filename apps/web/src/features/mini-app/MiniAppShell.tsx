import { useState, useEffect, useRef } from 'react'
import { router } from 'one'
import { SizableText, XStack, YStack } from 'tamagui'

import { useAuth } from '~/features/auth/client/authClient'
import { LiffBrowser } from '~/interface/liff/LiffBrowser'
import { API_URL } from '~/constants/urls'
import {
  buildLiffRuntimeContext,
  getEndpointOrigin,
  type LiffRuntimeContext,
} from '~/features/liff/liffRuntimeHelpers'
import { resolveLiffPermanentUrl } from '~/features/liff/resolveLiffPermanentUrl'
import { ShareTargetPicker } from '~/features/liff/ShareTargetPicker'
import { Pressable } from '~/interface/buttons/Pressable'
import { CaretLeftIcon } from '~/interface/icons/phosphor/CaretLeftIcon'
import { MiniAppActionMenu } from './MiniAppActionMenu'

type MiniAppMeta = {
  id: string
  name: string
  iconUrl: string | null
  description: string | null
  category: string | null
  liffId: string | null
}

type Props = {
  miniApp: MiniAppMeta
  forwardPath?: string
}

type ShareTargetPickerState = {
  visible: boolean
  messages: { type: string; text?: string }[]
  isMultiple: boolean
}

export function MiniAppShell({ miniApp, forwardPath }: Props) {
  const { state } = useAuth()
  const [runtimeCtx, setRuntimeCtx] = useState<LiffRuntimeContext | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [pickerState, setPickerState] = useState<ShareTargetPickerState>({
    visible: false,
    messages: [],
    isMultiple: true,
  })
  const iframeRef = useRef<HTMLIFrameElement | null>(null)

  useEffect(() => {
    if (!miniApp.liffId || state === 'loading') return

    const run = async () => {
      const ctx = await buildLiffRuntimeContext({
        apiBaseUrl: API_URL,
        liffId: miniApp.liffId!,
      })
      setRuntimeCtx(ctx)
    }

    void run().catch((e: unknown) => {
      const msg = e instanceof Error ? e.message : 'Unknown error'
      setError(msg)
    })
  }, [miniApp.liffId, state])

  const handleBack = () => {
    if (iframeRef.current?.contentWindow) {
      iframeRef.current.contentWindow.postMessage({ type: 'liff:host:back' }, '*')
    }
    router.back()
  }

  const handleClose = () => {
    router.back()
  }

  const handleShareToChat = () => {
    const link = `${typeof location !== 'undefined' ? location.origin : ''}/m/${miniApp.id}`
    router.push(
      `/home?shareUrl=${encodeURIComponent(link)}` as Parameters<typeof router.push>[0],
    )
  }

  const handleShareTargetPicker = (payload: {
    type: 'liff:shareTargetPicker'
    messages: { type: string; text?: string }[]
    options: { isMultiple: boolean }
  }) => {
    setPickerState({
      visible: true,
      messages: payload.messages,
      isMultiple: payload.options.isMultiple,
    })
  }

  const handlePickerDone = (result: { status: 'sent' } | false) => {
    setPickerState({ visible: false, messages: [], isMultiple: true })
    if (iframeRef.current?.contentWindow) {
      iframeRef.current.contentWindow.postMessage(
        { type: 'liff:shareTargetPicker:done', ...result },
        '*',
      )
    }
  }

  const permanentLink =
    typeof location !== 'undefined'
      ? `${location.origin}/m/${miniApp.id}${forwardPath ?? ''}`
      : `/m/${miniApp.id}${forwardPath ?? ''}`

  const endpointDomain = runtimeCtx?.endpointOrigin
    ? (() => {
        try {
          return new URL(runtimeCtx.endpointOrigin).hostname
        } catch {
          return runtimeCtx.endpointOrigin
        }
      })()
    : typeof location !== 'undefined'
      ? location.hostname
      : ''

  const resolvedUrl = runtimeCtx
    ? resolveLiffPermanentUrl({
        endpointUrl: runtimeCtx.endpointUrl,
        permanentPath: forwardPath,
      })
    : null

  return (
    <YStack flex={1} bg="$background">
      {/* Top bar */}
      <XStack
        height={56}
        items="center"
        px="$2"
        gap="$1"
        borderBottomWidth={1}
        borderBottomColor="$borderColor"
        bg="$color1"
      >
        {/* Back button */}
        <Pressable
          onPress={handleBack}
          width={36}
          height={36}
          items="center"
          justify="center"
        >
          <CaretLeftIcon size={24} />
        </Pressable>

        {/* Center: name + domain */}
        <YStack flex={1} items="center" gap={0}>
          <SizableText size="$4" fontWeight="700" numberOfLines={1} color="$color12">
            {miniApp.name}
          </SizableText>
          {endpointDomain ? (
            <SizableText size="$1" color="$color10" numberOfLines={1}>
              {endpointDomain}
            </SizableText>
          ) : null}
        </YStack>

        {/* Action menu */}
        <MiniAppActionMenu
          miniApp={miniApp}
          permanentLink={permanentLink}
          onShareToChat={handleShareToChat}
        />

        {/* Close button */}
        <Pressable
          onPress={handleClose}
          width={36}
          height={36}
          items="center"
          justify="center"
        >
          <SizableText size="$5" color="$color11">
            ×
          </SizableText>
        </Pressable>
      </XStack>

      {/* Loading bar */}
      {!loaded && (
        <YStack height={3} bg="$color1">
          <YStack height="100%" bg="$green9" width="60%" style={{ animation: 'none' }} />
        </YStack>
      )}

      {/* Error state */}
      {error && (
        <YStack flex={1} items="center" justify="center" p="$6" gap="$3">
          <SizableText size="$5" color="$color12" fontWeight="700">
            Failed to load
          </SizableText>
          <SizableText size="$3" color="$red10" text="center">
            {error}
          </SizableText>
        </YStack>
      )}

      {/* LiffBrowser */}
      {!error && resolvedUrl && runtimeCtx && (
        <YStack flex={1}>
          <LiffBrowser
            endpointUrl={resolvedUrl}
            liffId={miniApp.liffId!}
            endpointOrigin={getEndpointOrigin(resolvedUrl)}
            apiBaseUrl={API_URL}
            accessToken={runtimeCtx.accessToken}
            chatId={runtimeCtx.chatId}
            contextType={runtimeCtx.contextType}
            scopes={runtimeCtx.scopes}
            miniApp={miniApp}
            forwardPath={forwardPath}
            onLoad={() => setLoaded(true)}
            onIframeRef={(ref) => {
              iframeRef.current = ref
            }}
            onShareTargetPicker={handleShareTargetPicker}
          />
          {pickerState.visible && (
            <ShareTargetPicker
              messages={pickerState.messages}
              isMultiple={pickerState.isMultiple}
              onDone={handlePickerDone}
            />
          )}
        </YStack>
      )}

      {/* Loading state (waiting for runtimeCtx) */}
      {!error && !resolvedUrl && (
        <YStack flex={1} items="center" justify="center">
          <SizableText size="$3" color="$color10">
            Opening Mini App…
          </SizableText>
        </YStack>
      )}
    </YStack>
  )
}
