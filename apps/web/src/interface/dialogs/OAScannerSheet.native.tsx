import { useState } from 'react'
import { Linking } from 'react-native'
import { Sheet, Text, XStack, YStack } from 'tamagui'
import { CameraView, useCameraPermissions } from 'expo-camera'

import { oaClient } from '~/features/oa/client'
import { parseOAScanResult } from '~/features/oa/parse-qr'
import { showToast } from '~/interface/toast/Toast'
import { Button } from '~/interface/buttons/Button'
import { Input } from '~/interface/forms/Input'

import type { OADetailData } from '~/interface/dialogs/OADetailSheet'

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
  const [scanned, setScanned] = useState(false)
  const [permission, requestPermission] = useCameraPermissions()

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

  const handleBarcodeScanned = (result: { data: string }) => {
    if (scanned) return
    setScanned(true)
    const uniqueId = parseOAScanResult(result.data)
    resolveOA(uniqueId)
  }

  const handleManualSubmit = () => {
    const uniqueId = parseOAScanResult(manualInput.trim())
    resolveOA(uniqueId)
  }

  const handleOpenSettings = () => {
    void Linking.openSettings()
  }

  const handleRequestPermission = async () => {
    const result = await requestPermission()
    if (!result.granted) {
      showToast('相機權限被拒絕', { type: 'error' })
    }
  }

  // Reset scanned state when sheet opens
  const handleOpenChange = (isOpen: boolean) => {
    if (isOpen) {
      setScanned(false)
    }
    onOpenChange(isOpen)
  }

  const showPermissionPrompt = permission && !permission.granted && permission.canAskAgain

  const showPermissionDenied =
    permission && !permission.granted && !permission.canAskAgain

  return (
    <Sheet modal open={open} onOpenChange={handleOpenChange} snapPoints={[80]}>
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
            {open && permission?.granted && (
              <CameraView
                style={{ flex: 1 }}
                facing="back"
                barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
                onBarcodeScanned={handleBarcodeScanned}
              />
            )}

            {open && showPermissionPrompt && (
              <YStack flex={1} items="center" justify="center" gap="$3" p="$4">
                <Text fontSize={15} color="$color11" text="center">
                  需要相機權限才能掃描 QR Code
                </Text>
                <Button onPress={handleRequestPermission}>允許相機權限</Button>
              </YStack>
            )}

            {open && showPermissionDenied && (
              <YStack flex={1} items="center" justify="center" gap="$3" p="$4">
                <Text fontSize={15} color="$color11" text="center">
                  相機權限已被拒絕。請前往系統設定開啟相機權限。
                </Text>
                <Button onPress={handleOpenSettings}>開啟設定</Button>
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
