import { memo, useMemo } from 'react'
import { ScrollView, Text, XStack, YStack } from 'tamagui'
import { TextArea } from '~/interface/forms/TextArea'
import { FlexSimulatorPreview } from './FlexMessagePreview'
import { parseFlexMessageJson } from './flexMessageJson'

type FlexMessageJsonEditorProps = {
  value: string
  onChange(value: string): void
}

export const FlexMessageJsonEditor = memo(({ value, onChange }: FlexMessageJsonEditorProps) => {
  const parseResult = useMemo(() => parseFlexMessageJson(value), [value])
  const errorMsg = parseResult.ok ? '' : parseResult.message

  return (
    <XStack flex={1} gap="$4" style={{ minHeight: 0 }}>
      <YStack flex={1} gap="$2">
        <Text fontSize="$3" fontWeight="600" color="$color11">
          JSON Input
        </Text>
        {errorMsg ? (
          <Text fontSize="$2" color="$red10">
            {errorMsg}
          </Text>
        ) : null}
        <TextArea flex={1} value={value} onChangeText={onChange} p="$3" hasError={Boolean(errorMsg)} />
      </YStack>
      <YStack flex={1} gap="$2" style={{ minHeight: 0 }}>
        <Text fontSize="$3" fontWeight="600" color="$color11">
          Preview
        </Text>
        <YStack flex={1} data-testid="flex-simulator-preview-frame" style={{ minHeight: 800, overflow: 'hidden', borderRadius: 8 }}>
          <ScrollView>
            <FlexSimulatorPreview json={value} />
          </ScrollView>
        </YStack>
      </YStack>
    </XStack>
  )
})
