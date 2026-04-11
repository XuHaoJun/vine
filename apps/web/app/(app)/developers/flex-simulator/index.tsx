import { memo, useCallback, useEffect, useState } from 'react'
import { ScrollView, Text, XStack, YStack } from 'tamagui'

import { TextArea } from '~/interface/forms/TextArea'

import { useFlexSimulatorHeader } from './FlexSimulatorHeaderContext'
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
  const { setResetHandler } = useFlexSimulatorHeader()
  const [json, setJson] = useState(DEFAULT_JSON)
  const [isValid, setIsValid] = useState(true)
  const [errorMsg, setErrorMsg] = useState('')

  const handleReset = useCallback(() => {
    setJson(DEFAULT_JSON)
    setIsValid(true)
    setErrorMsg('')
  }, [])

  useEffect(() => {
    setResetHandler(() => handleReset)
    return () => setResetHandler(null)
  }, [handleReset, setResetHandler])

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

  return (
    <YStack flex={1} gap="$4" style={{ minHeight: 0 }}>
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
          <TextArea
            flex={1}
            value={json}
            onChangeText={handleJsonChange}
            p="$3"
            hasError={!isValid}
          />
        </YStack>

        <YStack flex={1} gap="$2" style={{ minHeight: 0 }}>
          <Text fontSize="$3" fontWeight="600" color="$color11">
            Preview
          </Text>
          <YStack
            flex={1}
            data-testid="flex-simulator-preview-frame"
            style={{ minHeight: 800, overflow: 'hidden', borderRadius: 8 }}
          >
            <ScrollView>
              <FlexSimulatorPreview json={json} />
            </ScrollView>
          </YStack>
        </YStack>
      </XStack>
    </YStack>
  )
})

export default FlexSimulatorPage
