import { memo, useEffect, useState } from 'react'
import { SizableText, Spinner, YStack } from 'tamagui'
import { useAuth } from '~/features/auth/client/authClient'
import { LiffBrowser } from '~/interface/liff/LiffBrowser'
import { ShareTargetPicker } from '~/features/liff/ShareTargetPicker'
import { resolveLiffPermanentUrl } from '~/features/liff/resolveLiffPermanentUrl'
import { API_URL } from '~/constants/urls'
import { getEndpointOrigin, buildLiffRuntimeContext, type LiffRuntimeContext } from './liffRuntimeHelpers'

export {
  LIFF_LINE_VERSION,
  createLiffIframeSrc,
  createLiffBootstrap,
  getEndpointOrigin,
  isAllowedLiffMessageOrigin,
  canSendMessages,
  resolveLiffLaunchContext,
  createLiffAccessToken,
  buildLiffRuntimeContext,
  type LiffAppConfig,
  type LiffRuntimeContext,
} from './liffRuntimeHelpers'

type ShareTargetPickerState = {
  visible: boolean
  messages: { type: string; text?: string }[]
  isMultiple: boolean
}

export type LiffRouteShellProps = {
  liffId: string
  permanentPath?: string
  hash?: string
}

export const LiffRouteShell = memo(
  ({ liffId, permanentPath, hash }: LiffRouteShellProps) => {
    const { state } = useAuth()
    const [error, setError] = useState<string | null>(null)
    const [runtimeCtx, setRuntimeCtx] = useState<LiffRuntimeContext | null>(null)
    const [pickerState, setPickerState] = useState<ShareTargetPickerState>({
      visible: false,
      messages: [],
      isMultiple: true,
    })

    useEffect(() => {
      if (!liffId || state === 'loading') return

      const launchToken =
        typeof window !== 'undefined'
          ? new URLSearchParams(window.location.search).get('launchToken')
          : null

      const run = async () => {
        const ctx = await buildLiffRuntimeContext({
          apiBaseUrl: API_URL,
          liffId,
          launchToken,
        })
        setRuntimeCtx(ctx)
      }

      void run().catch((e: unknown) => {
        const msg = e instanceof Error ? e.message : 'Unknown error'
        setError(msg)
      })
    }, [liffId, state])

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
      const iframe = document.getElementById(
        'liff-browser-iframe',
      ) as HTMLIFrameElement | null
      if (iframe?.contentWindow) {
        iframe.contentWindow.postMessage(
          { type: 'liff:shareTargetPicker:done', ...result },
          '*',
        )
      }
    }

    if (error) {
      return (
        <YStack flex={1} items="center" justify="center" gap="$4" p="$6">
          <SizableText size="$5" color="$color12" fontWeight="700">
            LIFF Error
          </SizableText>
          <SizableText size="$3" color="$red10" text="center">
            {error}
          </SizableText>
        </YStack>
      )
    }

    if (!runtimeCtx) {
      return (
        <YStack flex={1} items="center" justify="center" gap="$4">
          <Spinner size="large" />
          <SizableText size="$3" color="$color10">
            Opening LIFF app…
          </SizableText>
        </YStack>
      )
    }

    const resolvedUrl = resolveLiffPermanentUrl({
      endpointUrl: runtimeCtx.endpointUrl,
      permanentPath,
      hash,
    })

    return (
      <YStack flex={1}>
        <LiffBrowser
          endpointUrl={resolvedUrl}
          liffId={liffId}
          endpointOrigin={getEndpointOrigin(resolvedUrl)}
          apiBaseUrl={API_URL}
          accessToken={runtimeCtx.accessToken}
          chatId={runtimeCtx.chatId}
          contextType={runtimeCtx.contextType}
          scopes={runtimeCtx.scopes}
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
    )
  },
)
