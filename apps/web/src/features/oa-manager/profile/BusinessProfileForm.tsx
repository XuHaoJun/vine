import { Label, SizableText, XStack, YStack } from 'tamagui'
import { Image } from 'react-native'
import { Button } from '~/interface/buttons/Button'
import { Input } from '~/interface/forms/Input'
import { Switch } from '~/interface/forms/Switch'
import { BusinessProfileImageKind } from '@vine/proto/oa'
import type { BusinessProfile, BusinessProfilePatch } from '@vine/proto/oa'

type Props = {
  draft: BusinessProfile | undefined
  onSave: (patch: BusinessProfilePatch) => void
  onUploadImage: (input: {
    kind: BusinessProfileImageKind
    image: Uint8Array
    contentType: string
  }) => void
  onRemoveImage: (kind: BusinessProfileImageKind) => void
}

export function BusinessProfileForm({ draft, onSave, onUploadImage, onRemoveImage }: Props) {
  if (!draft) return null

  return (
    <YStack gap="$5" maxW={820}>
      <SizableText size="$7" fontWeight="700">
        Edit business profile
      </SizableText>
      <XStack gap="$4" items="center">
        <YStack gap="$2">
          <SizableText fontWeight="700">Profile photo</SizableText>
          {draft.profileImageUrl ? (
            <Image
              source={{ uri: draft.profileImageUrl }}
              style={{ width: 72, height: 72, borderRadius: 36 }}
            />
          ) : null}
          <Button
            variant="outlined"
            onPress={() => onRemoveImage(BusinessProfileImageKind.PROFILE)}
          >
            Remove profile photo
          </Button>
        </YStack>
        <YStack gap="$2">
          <SizableText fontWeight="700">Cover photo</SizableText>
          {draft.coverImageUrl ? (
            <Image
              source={{ uri: draft.coverImageUrl }}
              style={{ width: 220, height: 96 }}
            />
          ) : null}
          <Button
            variant="outlined"
            onPress={() => onRemoveImage(BusinessProfileImageKind.COVER)}
          >
            Remove cover photo
          </Button>
        </YStack>
      </XStack>
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
      <YStack gap="$3">
        <Label>Phone number</Label>
        <Input
          defaultValue={draft.phoneNumber}
          onBlur={(event) =>
            onSave({ phoneNumber: (event.currentTarget as HTMLInputElement).value } as unknown as BusinessProfilePatch)
          }
        />
      </YStack>
      <YStack gap="$3">
        <Label>Footer button splash labels</Label>
        <Input
          defaultValue={draft.splashLabels.join(', ')}
          onBlur={(event) =>
            onSave({
              splashLabels: {
                values: (event.currentTarget as HTMLInputElement).value
                  .split(',')
                  .map((label) => label.trim())
                  .filter(Boolean)
                  .slice(0, 3),
              },
            } as unknown as BusinessProfilePatch)
          }
        />
      </YStack>
    </YStack>
  )
}
