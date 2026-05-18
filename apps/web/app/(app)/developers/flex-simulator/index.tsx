import { memo, useCallback, useEffect, useState } from 'react'
import { YStack } from 'tamagui'
import { defaultFlexMessageJson } from '~/features/rich-message/flex/defaultFlexMessage'
import { FlexMessageJsonEditor } from '~/features/rich-message/flex/FlexMessageJsonEditor'
import { useOADetailSheet } from '~/interface/dialogs/OADetailSheet'
import { useFlexSimulatorHeader } from './FlexSimulatorHeaderContext'
import { FlexSimulatorSendDialog } from './FlexSimulatorSendDialog'

const FlexSimulatorPage = memo(() => {
  const { setResetHandler, setSendHandler } = useFlexSimulatorHeader()
  const [json, setJson] = useState(defaultFlexMessageJson)
  const [sendDialogOpen, setSendDialogOpen] = useState(false)
  const { openDetail, DetailSheetComponent } = useOADetailSheet()

  const handleReset = useCallback(() => {
    setJson(defaultFlexMessageJson)
  }, [])

  useEffect(() => {
    setResetHandler(() => handleReset)
    return () => setResetHandler(null)
  }, [handleReset, setResetHandler])

  useEffect(() => {
    setSendHandler(() => () => setSendDialogOpen(true))
    return () => setSendHandler(null)
  }, [setSendHandler])

  return (
    <YStack flex={1} gap="$4" style={{ minHeight: 0 }}>
      <FlexMessageJsonEditor value={json} onChange={setJson} />
      <FlexSimulatorSendDialog
        open={sendDialogOpen}
        onOpenChange={setSendDialogOpen}
        flexJson={json}
        openOADetail={openDetail}
      />
      {DetailSheetComponent}
    </YStack>
  )
})

export default FlexSimulatorPage
