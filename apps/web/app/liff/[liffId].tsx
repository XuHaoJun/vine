import { useActiveParams, createRoute } from 'one'
import { memo, useEffect, useState } from 'react'
import { SizableText, Spinner, YStack } from 'tamagui'
import { useAuth } from '~/features/auth/client/authClient'
import { LiffBrowser } from '~/interface/liff/LiffBrowser'
import { ShareTargetPicker } from '~/features/liff/ShareTargetPicker'

const route = createRoute<'/liff/[liffId]'>()

type LiffAppConfig = {
  liffId: string
  viewType: string
  endpointUrl: string
  moduleMode: boolean
  scopes: string[]
  botPrompt: string
  qrCode: boolean
}

type ShareTargetPickerState = {
  visible: boolean
  messages: { type: string; text?: string }[]
  isMultiple: boolean
}

export const LiffPage = memo(() => {
  const params = useActiveParams<{ liffId: string }>()
  const { liffId } = params
  const { state } = useAuth()
  const [error, setError] = useState<string | null>(null)
  const [config, setConfig] = useState<LiffAppConfig | null>(null)
  const [pickerState, setPickerState] = useState<ShareTargetPickerState>({
    visible: false,
    messages: [],
    isMultiple: true,
  })

  useEffect(() => {
    if (!liffId || state === 'loading') return

    const run = async () => {
      const res = await fetch(`/liff/v1/apps/${liffId}`)
      if (!res.ok) {
        setError(`LIFF app "${liffId}" not found`)
        return
      }
      const cfg = (await res.json()) as LiffAppConfig
      setConfig(cfg)
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
    // Post result back to iframe
    const iframe = document.querySelector('iframe')
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

  if (!config) {
    return (
      <YStack flex={1} items="center" justify="center" gap="$4">
        <Spinner size="large" />
        <SizableText size="$3" color="$color10">
          Opening LIFF app…
        </SizableText>
      </YStack>
    )
  }

  return (
    <YStack flex={1}>
      <LiffBrowser
        endpointUrl={config.endpointUrl}
        liffId={liffId ?? ''}
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
})

export default LiffPage
