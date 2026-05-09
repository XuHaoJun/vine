import { Label, SizableText, XStack, YStack } from 'tamagui'
import { Button } from '~/interface/buttons/Button'
import { Input } from '~/interface/forms/Input'
import { Switch } from '~/interface/forms/Switch'
import type { BusinessProfile, BusinessProfilePatch } from '@vine/proto/oa'

type Props = {
  draft: BusinessProfile | undefined
  onSave: (patch: BusinessProfilePatch) => void
}

export function BusinessProfileForm({ draft, onSave }: Props) {
  if (!draft) return null

  return (
    <YStack gap="$5" maxW={820}>
      <SizableText size="$7" fontWeight="700">
        Edit business profile
      </SizableText>
      <YStack gap="$3">
        <Label>Account name</Label>
        <Input
          defaultValue={draft.displayName}
          onBlur={(event) => onSave({ displayName: (event.currentTarget as HTMLInputElement).value } as unknown as BusinessProfilePatch)}
        />
      </YStack>
      <YStack gap="$3">
        <Label>Unique ID</Label>
        <Input
          defaultValue={draft.uniqueId}
          onBlur={(event) => onSave({ uniqueId: (event.currentTarget as HTMLInputElement).value } as unknown as BusinessProfilePatch)}
        />
      </YStack>
      <YStack gap="$3">
        <Label>Status message</Label>
        <Input
          defaultValue={draft.statusMessage}
          onBlur={(event) => onSave({ statusMessage: (event.currentTarget as HTMLInputElement).value } as unknown as BusinessProfilePatch)}
        />
      </YStack>
      <XStack items="center" justify="space-between">
        <YStack>
          <SizableText fontWeight="700">Show number of followers</SizableText>
          <SizableText size="$2" color="$color10">
            Show follower count on the profile page.
          </SizableText>
        </YStack>
        <Switch
          checked={draft.showFollowerCount}
          onCheckedChange={(value) => onSave({ showFollowerCount: value } as unknown as BusinessProfilePatch)}
        />
      </XStack>
      <YStack gap="$3">
        <SizableText size="$5" fontWeight="700">
          Design
        </SizableText>
        <Button onPress={() => onSave({ footerButtonColor: '#06c755' } as unknown as BusinessProfilePatch)}>
          Use Vine green footer button
        </Button>
      </YStack>
    </YStack>
  )
}
