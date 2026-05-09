import { SizableText, XStack, YStack } from 'tamagui'
import { Button } from '~/interface/buttons/Button'
import type { BusinessProfile } from '@vine/proto/oa'
import type { EditorSection } from './clientTypes'

type Props = {
  draft: BusinessProfile | undefined
  selected: EditorSection
  onSelect: (section: EditorSection) => void
}

const blocks: Array<{ key: EditorSection; label: string }> = [
  { key: 'businessProfile', label: 'Business profile' },
  { key: 'announcements', label: 'Announcements' },
  { key: 'mixedMediaFeed', label: 'Mixed media feed' },
  { key: 'socialMedia', label: 'Social media' },
  { key: 'basicInfo', label: 'Basic info' },
]

export function BusinessProfilePreview({ draft, selected, onSelect }: Props) {
  return (
    <YStack width={420} shrink={0} bg="$color2" borderRightWidth={1} borderColor="$borderColor">
      <XStack p="$3" justify="flex-end">
        <Button size="$2" variant="outlined">
          Preview
        </Button>
      </XStack>
      <YStack px="$6" gap="$4" $platform-web={{ overflowY: 'auto' }}>
        {blocks.map((block) => (
          <YStack
            key={block.key}
            p="$3"
            bg="$background"
            borderWidth={1}
            borderStyle={selected === block.key ? 'dashed' : 'solid'}
            borderColor={selected === block.key ? '$blue8' : '$borderColor'}
            rounded="$2"
            gap="$2"
            cursor="pointer"
            onPress={() => onSelect(block.key)}
          >
            <XStack items="center" justify="space-between">
              <SizableText size="$3" fontWeight="700">
                {block.key === 'businessProfile' ? draft?.displayName || 'Account' : block.label}
              </SizableText>
              {selected === block.key ? (
                <SizableText size="$1" color="$blue10">
                  Edit
                </SizableText>
              ) : null}
            </XStack>
            <SizableText size="$2" color="$color10">
              {block.key === 'businessProfile'
                ? draft?.statusMessage || 'No status message'
                : 'Configure this profile block.'}
            </SizableText>
          </YStack>
        ))}
      </YStack>
      <YStack mt="auto" p="$4" borderTopWidth={1} borderColor="$borderColor">
        <SizableText size="$3" fontWeight="700" color="$green10" text="center">
          + Add plug-in
        </SizableText>
      </YStack>
    </YStack>
  )
}
