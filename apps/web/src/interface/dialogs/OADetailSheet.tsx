import { useState } from 'react'
import { Sheet } from 'tamagui'

import { OADetailContent, type OADetailContentData } from '~/interface/oa/OADetailContent'

export type OADetailData = OADetailContentData

type OADetailSheetProps = OADetailData & {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function OADetailSheet({
  id,
  name,
  oaId,
  imageUrl,
  open,
  onOpenChange,
}: OADetailSheetProps) {
  return (
    <Sheet modal open={open} onOpenChange={onOpenChange} snapPoints={[100]}>
      <Sheet.Overlay
        opacity={0.5}
        enterStyle={{ opacity: 0 }}
        exitStyle={{ opacity: 0 }}
      />
      <Sheet.Frame flex={1} bg="$background">
        <OADetailContent
          id={id}
          name={name}
          oaId={oaId}
          imageUrl={imageUrl}
          onClose={() => onOpenChange(false)}
          showCloseButton
        />
      </Sheet.Frame>
    </Sheet>
  )
}

export function useOADetailSheet() {
  const [selectedOA, setSelectedOA] = useState<OADetailData | null>(null)

  const openDetail = (oa: OADetailData) => {
    setSelectedOA(oa)
  }

  const DetailSheetComponent = selectedOA ? (
    <OADetailSheet
      id={selectedOA.id}
      name={selectedOA.name}
      oaId={selectedOA.oaId}
      imageUrl={selectedOA.imageUrl}
      open={true}
      onOpenChange={(open) => {
        if (!open) setSelectedOA(null)
      }}
    />
  ) : null

  return { openDetail, DetailSheetComponent }
}
