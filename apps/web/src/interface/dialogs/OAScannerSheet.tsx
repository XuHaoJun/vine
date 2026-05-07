import { Scanner } from '@yudiel/react-qr-scanner'
import { useState } from 'react'
import { Sheet, Text, XStack, YStack } from 'tamagui'
import { oaClient } from '~/features/oa/client'
import { parseOAScanResult } from '~/features/oa/parse-qr'
import { Button } from '~/interface/buttons/Button'
import { Input } from '~/interface/forms/Input'
import { showToast } from '~/interface/toast/Toast'
import type { OADetailData } from '~/interface/dialogs/OADetailSheet'

type CameraError =
  | { type: 'notAllowed' }
  | { type: 'notFound' }
  | { type: 'unknown'; message: string }

type OAScannerSheetProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onScanResult: (oa: OADetailData) => void
}

export function OAScannerSheet({
  open,
  onOpenChange,
  onScanResult,
}: OAScannerSheetProps) {
  const [manualInput, setManualInput] = useState('')
  const [resolving, setResolving] = useState(false)
  const [cameraError, setCameraError] = useState<CameraError | null>(null)

  const resolveOA = async (uniqueId: string) => {
    if (!uniqueId) return
    setResolving(true)
    try {
      const result = await oaClient.resolveOfficialAccount({ uniqueId })
      if (result.account) {
        onOpenChange(false)
        onScanResult({
          id: result.account.id,
          name: result.account.name,
          oaId: result.account.uniqueId,
          imageUrl: result.account.imageUrl || undefined,
        })
      }
    } catch {
      showToast('找不到此官方帳號', { type: 'error' })
    } finally {
      setResolving(false)
    }
  }

  const handleScan = (detectedCodes: Array<{ rawValue: string }>) => {
    const firstCode = detectedCodes[0]
    if (!firstCode) return
    const content = firstCode.rawValue
    const uniqueId = parseOAScanResult(content)
    resolveOA(uniqueId)
  }

  const handleManualSubmit = () => {
    const uniqueId = parseOAScanResult(manualInput.trim())
    resolveOA(uniqueId)
  }

  const handleScannerError = (error: unknown) => {
    console.error('QR Scanner error:', error)

    if (error instanceof DOMException) {
      if (error.name === 'NotAllowedError') {
        setCameraError({ type: 'notAllowed' })
        showToast('相機權限被拒絕', { type: 'error' })
        return
      }
      if (error.name === 'NotFoundError') {
        setCameraError({ type: 'notFound' })
        showToast('找不到相機裝置', { type: 'error' })
        return
      }
    }

    const message = error instanceof Error ? error.message : '相機存取失敗'
    setCameraError({ type: 'unknown', message })
    showToast(message, { type: 'error' })
  }

  const handleRetry = () => {
    setCameraError(null)
  }

  const openSettings = () => {
    // On web, guide user to browser settings. We cannot programmatically
    // open browser permission settings, so show a helpful toast.
    showToast('請在網址列左側點擊相機圖示，允許相機權限後重新整理頁面', {
      type: 'info',
    })
  }

  return (
    <Sheet modal open={open} onOpenChange={onOpenChange} snapPoints={[80]}>
      <Sheet.Overlay
        opacity={0.5}
        enterStyle={{ opacity: 0 }}
        exitStyle={{ opacity: 0 }}
      />
      <Sheet.Frame flex={1} bg="$background" p="$4">
        <YStack gap="$4" flex={1}>
          <Text fontSize={18} fontWeight="700" color="$color12">
            掃描官方帳號
          </Text>

          <YStack height={280} rounded="$4" overflow="hidden" bg="$color3">
            {open && !cameraError && (
              <Scanner
                onScan={handleScan}
                onError={handleScannerError}
                styles={{ container: { width: '100%', height: '100%' } }}
              />
            )}

            {cameraError && (
              <YStack flex={1} items="center" justify="center" gap="$3" p="$4">
                <Text fontSize={15} color="$color11" text="center">
                  {cameraError.type === 'notAllowed' && '需要相機權限才能掃描 QR Code'}
                  {cameraError.type === 'notFound' && '找不到相機裝置'}
                  {cameraError.type === 'unknown' && cameraError.message}
                </Text>
                <XStack gap="$2">
                  {cameraError.type === 'notAllowed' && (
                    <Button onPress={openSettings}>如何授權</Button>
                  )}
                  <Button onPress={handleRetry}>重試</Button>
                </XStack>
              </YStack>
            )}
          </YStack>

          <YStack gap="$2">
            <Text fontSize={13} color="$color10">
              或輸入官方帳號 ID
            </Text>
            <XStack gap="$2">
              <Input
                flex={1}
                placeholder="@official-account"
                value={manualInput}
                onChangeText={setManualInput}
                onSubmitEditing={handleManualSubmit}
              />
              <Button
                onPress={handleManualSubmit}
                disabled={resolving || !manualInput.trim()}
              >
                {resolving ? '查詢中...' : '查詢'}
              </Button>
            </XStack>
          </YStack>
        </YStack>
      </Sheet.Frame>
    </Sheet>
  )
}

export function useOAScannerSheet() {
  const [open, setOpen] = useState(false)
  const [onResult, setOnResult] = useState<((oa: OADetailData) => void) | null>(null)

  const openScanner = (callback: (oa: OADetailData) => void) => {
    setOnResult(() => callback)
    setOpen(true)
  }

  const ScannerSheetComponent = (
    <OAScannerSheet
      open={open}
      onOpenChange={setOpen}
      onScanResult={(oa) => {
        onResult?.(oa)
        setOpen(false)
      }}
    />
  )

  return { openScanner, ScannerSheetComponent }
}
