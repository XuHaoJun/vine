import { BusinessProfileImageKind } from '@vine/proto/oa'
import { Image, Platform } from 'react-native'
import { Label, SizableText, XStack, YStack } from 'tamagui'
import { Button } from '~/interface/buttons/Button'
import { Input } from '~/interface/forms/Input'
import { Switch } from '~/interface/forms/Switch'
import type { BusinessProfile, BusinessProfilePatch } from '@vine/proto/oa'

type Props = {
  draft: BusinessProfile | undefined
  onSave: (patch: BusinessProfilePatch) => void
  onImmediateSave: (patch: BusinessProfilePatch) => void
  onUploadImage: (input: {
    kind: BusinessProfileImageKind
    image: Uint8Array
    contentType: string
  }) => void
  onRemoveImage: (kind: BusinessProfileImageKind) => void
}

function handleFileSelect(
  kind: BusinessProfileImageKind,
  onUpload: Props['onUploadImage'],
) {
  if (Platform.OS !== 'web') return
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = 'image/jpeg,image/png'
  input.onchange = async () => {
    const file = input.files?.[0]
    if (!file) return
    const buffer = await file.arrayBuffer()
    onUpload({
      kind,
      image: new Uint8Array(buffer),
      contentType: file.type,
    })
  }
  input.click()
}

export function BusinessProfileForm({
  draft,
  onSave,
  onImmediateSave,
  onUploadImage,
  onRemoveImage,
}: Props) {
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
          <XStack gap="$2">
            <Button
              size="$2"
              variant="outlined"
              onPress={() =>
                handleFileSelect(BusinessProfileImageKind.PROFILE, onUploadImage)
              }
            >
              Upload
            </Button>
            {draft.profileImageUrl ? (
              <Button
                size="$2"
                variant="outlined"
                onPress={() => onRemoveImage(BusinessProfileImageKind.PROFILE)}
              >
                Remove
              </Button>
            ) : null}
          </XStack>
        </YStack>
        <YStack gap="$2">
          <SizableText fontWeight="700">Cover photo</SizableText>
          {draft.coverImageUrl ? (
            <Image
              source={{ uri: draft.coverImageUrl }}
              style={{ width: 220, height: 96 }}
            />
          ) : null}
          <XStack gap="$2">
            <Button
              size="$2"
              variant="outlined"
              onPress={() =>
                handleFileSelect(BusinessProfileImageKind.COVER, onUploadImage)
              }
            >
              Upload
            </Button>
            {draft.coverImageUrl ? (
              <Button
                size="$2"
                variant="outlined"
                onPress={() => onRemoveImage(BusinessProfileImageKind.COVER)}
              >
                Remove
              </Button>
            ) : null}
          </XStack>
        </YStack>
      </XStack>
      <YStack gap="$3">
        <Label>Account name</Label>
        <Input
          value={draft.displayName}
          onChangeText={(text: string) =>
            onSave({ displayName: text } as unknown as BusinessProfilePatch)
          }
        />
      </YStack>
      <YStack gap="$3">
        <Label>Unique ID</Label>
        <Input
          value={draft.uniqueId}
          onChangeText={(text: string) =>
            onSave({ uniqueId: text } as unknown as BusinessProfilePatch)
          }
        />
      </YStack>
      <YStack gap="$3">
        <Label>Status message</Label>
        <Input
          value={draft.statusMessage}
          onChangeText={(text: string) =>
            onSave({ statusMessage: text } as unknown as BusinessProfilePatch)
          }
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
          onCheckedChange={(value) =>
            onImmediateSave({
              showFollowerCount: value,
            } as unknown as BusinessProfilePatch)
          }
        />
      </XStack>
      <YStack gap="$3">
        <SizableText size="$5" fontWeight="700">
          Design
        </SizableText>
        <Button
          onPress={() =>
            onImmediateSave({
              footerButtonColor: '#06c755',
            } as unknown as BusinessProfilePatch)
          }
        >
          Use Vine green footer button
        </Button>
      </YStack>
      <YStack gap="$3">
        <Label>Phone number</Label>
        <Input
          value={draft.phoneNumber}
          onChangeText={(text: string) =>
            onSave({ phoneNumber: text } as unknown as BusinessProfilePatch)
          }
        />
      </YStack>
      <YStack gap="$3">
        <Label>Footer button splash labels</Label>
        <Input
          value={draft.splashLabels.join(', ')}
          onChangeText={(text: string) =>
            onSave({
              splashLabels: {
                values: text
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
