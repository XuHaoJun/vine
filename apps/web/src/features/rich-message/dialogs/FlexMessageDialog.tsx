import { useState } from 'react'
import { XStack, YStack, SizableText } from 'tamagui'
import { Button } from '~/interface/buttons/Button'
import { defaultFlexMessageJson } from '../flex/defaultFlexMessage'
import { FlexMessageJsonEditor } from '../flex/FlexMessageJsonEditor'
import { buildFlexDraftFromJson } from './draftFactories'
import type { FlexMessageDraft } from '../core/types'

type Props = {
  onCancel(): void
  onSave(draft: FlexMessageDraft): void
}

export function FlexMessageDialog({ onCancel, onSave }: Props) {
  const [json, setJson] = useState(defaultFlexMessageJson)
  let canSave = true
  try {
    JSON.parse(json)
  } catch {
    canSave = false
  }

  return (
    <YStack p="$4" gap="$3" borderWidth={1} borderColor="$borderColor" rounded="$3">
      <SizableText size="$5" fontWeight="700">
        Flex message
      </SizableText>
      <YStack height={520}>
        <FlexMessageJsonEditor value={json} onChange={setJson} />
      </YStack>
      <XStack justify="flex-end" gap="$2">
        <Button size="$2" variant="outlined" onPress={onCancel}>
          Cancel
        </Button>
        <Button
          size="$2"
          disabled={!canSave}
          onPress={() => {
            const result = buildFlexDraftFromJson({ id: crypto.randomUUID(), json })
            if (result.ok) onSave(result.draft)
          }}
        >
          Save flex message
        </Button>
      </XStack>
    </YStack>
  )
}
