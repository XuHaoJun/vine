import { memo, useState } from 'react'
import { Button, Input, XStack, YStack, Text, ScrollView } from 'tamagui'

import { FlexSimulatorPreview } from './FlexSimulatorPreview'

const DEFAULT_JSON = JSON.stringify(
  {
    type: 'flex',
    altText: 'Sample Flex Message',
    contents: {
      type: 'bubble',
      size: 'mega',
      body: {
        type: 'box',
        layout: 'vertical',
        contents: [
          {
            type: 'text',
            text: 'Hello World',
            size: 'lg',
            weight: 'bold',
            align: 'center',
          },
          {
            type: 'text',
            text: 'This is a sample Flex Message.',
            size: 'md',
            color: '#666666',
          },
        ],
      },
    },
  },
  null,
  2,
)

const FlexSimulatorPage = memo(() => {
  const [json, setJson] = useState(DEFAULT_JSON)
  const [isValid, setIsValid] = useState(true)
  const [errorMsg, setErrorMsg] = useState('')

  const handleJsonChange = (value: string) => {
    setJson(value)
    try {
      JSON.parse(value)
      setIsValid(true)
      setErrorMsg('')
    } catch (e) {
      setIsValid(false)
      setErrorMsg(e instanceof Error ? e.message : 'Invalid JSON')
    }
  }

  const handleReset = () => {
    setJson(DEFAULT_JSON)
    setIsValid(true)
    setErrorMsg('')
  }

  return (
    <YStack flex={1} gap="$4">
      <XStack items="center" justify="space-between">
        <Text fontSize="$6" fontWeight="700" color="$color12">
          Flex Simulator
        </Text>
        <XStack gap="$2">
          <Button size="$2" onPress={handleReset}>
            Reset
          </Button>
        </XStack>
      </XStack>

      <XStack flex={1} gap="$4" style={{ minHeight: 0 }}>
        <YStack flex={1} gap="$2">
          <Text fontSize="$3" fontWeight="600" color="$color11">
            JSON Input
          </Text>
          {!isValid && (
            <Text fontSize="$2" color="$red10">
              {errorMsg}
            </Text>
          )}
          <Input
            flex={1}
            multiline
            value={json}
            onChangeText={handleJsonChange}
            textAlignVertical="top"
            p="$3"
            borderColor={isValid ? '$borderColor' : '$red10'}
          />
        </YStack>

        <YStack flex={1} gap="$2">
          <Text fontSize="$3" fontWeight="600" color="$color11">
            Preview
          </Text>
          <ScrollView flex={1} borderWidth={1} borderColor="$borderColor">
            <FlexSimulatorPreview json={json} />
          </ScrollView>
        </YStack>
      </XStack>
    </YStack>
  )
})

export default FlexSimulatorPage