import { useState } from 'react'
import { SizableText, XStack, YStack } from 'tamagui'
import { Button } from '~/interface/buttons/Button'
import { Input } from '~/interface/forms/Input'
import { buildMediaUrlDraft } from './draftFactories'
import type {
  AudioMessageDraft,
  ImageMessageDraft,
  VideoMessageDraft,
} from '../core/types'

type MediaType = 'image' | 'video' | 'audio'
type MediaDraft = ImageMessageDraft | VideoMessageDraft | AudioMessageDraft

type Props = {
  type: MediaType
  onCancel(): void
  onSave(draft: MediaDraft): void
}

export function MediaUrlDialog({ type, onCancel, onSave }: Props) {
  const [originalContentUrl, setOriginalContentUrl] = useState('')
  const [previewImageUrl, setPreviewImageUrl] = useState('')
  const [duration, setDuration] = useState('')
  const isAudio = type === 'audio'
  const canSave =
    originalContentUrl.startsWith('https://') &&
    (isAudio || previewImageUrl.startsWith('https://'))

  return (
    <YStack p="$4" gap="$3" borderWidth={1} borderColor="$borderColor" rounded="$3">
      <SizableText size="$5" fontWeight="700">
        {type} message
      </SizableText>
      <Input
        value={originalContentUrl}
        onChangeText={setOriginalContentUrl}
        placeholder={`https://example.com/${isAudio ? 'audio.m4a' : `${type}.jpg`}`}
      />
      {!isAudio ? (
        <Input
          value={previewImageUrl}
          onChangeText={setPreviewImageUrl}
          placeholder="https://example.com/preview.jpg"
        />
      ) : (
        <Input
          value={duration}
          onChangeText={setDuration}
          placeholder="Duration in milliseconds"
        />
      )}
      <XStack justify="flex-end" gap="$2">
        <Button size="$2" variant="outlined" onPress={onCancel}>
          Cancel
        </Button>
        <Button
          size="$2"
          disabled={!canSave}
          onPress={() => {
            const base = { id: crypto.randomUUID(), type, originalContentUrl }
            onSave(
              isAudio
                ? (buildMediaUrlDraft({
                    ...base,
                    type: 'audio',
                    duration: duration ? Number(duration) : undefined,
                  }) as AudioMessageDraft)
                : type === 'image'
                  ? (buildMediaUrlDraft({
                      ...base,
                      type: 'image',
                      previewImageUrl,
                    }) as ImageMessageDraft)
                  : (buildMediaUrlDraft({
                      ...base,
                      type: 'video',
                      previewImageUrl,
                    }) as VideoMessageDraft),
            )
          }}
        >
          Save {type} message
        </Button>
      </XStack>
    </YStack>
  )
}
