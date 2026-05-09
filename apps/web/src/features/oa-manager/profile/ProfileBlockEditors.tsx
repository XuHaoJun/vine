import { Label, SizableText, XStack, YStack } from 'tamagui'
import { Input } from '~/interface/forms/Input'
import { Switch } from '~/interface/forms/Switch'
import { makeProfileJson, parseProfileJson } from './clientTypes'
import type { BusinessProfile, BusinessProfilePatch } from '@vine/proto/oa'
import type { EditorSection } from './clientTypes'

type Props = {
  section: Exclude<EditorSection, 'businessProfile'>
  draft: BusinessProfile | undefined
  onSave: (patch: BusinessProfilePatch) => void
}

export function ProfileBlockEditors({ section, draft, onSave }: Props) {
  if (!draft) return null
  const labels: Record<typeof section, string> = {
    announcements: 'Announcements',
    mixedMediaFeed: 'Mixed media feed',
    socialMedia: 'Social media',
    basicInfo: 'Basic info',
  }
  const fieldName =
    section === 'basicInfo' ? 'basicInfoBlock' : section
  const value = parseProfileJson<Record<string, any>>(
    (draft as Record<string, unknown>)[fieldName] as { json?: string } | undefined,
    {},
  )

  return (
    <YStack gap="$4" maxW={760}>
      <SizableText size="$7" fontWeight="700">
        {labels[section]}
      </SizableText>
      <XStack items="center" justify="space-between">
        <SizableText fontWeight="700">Enabled</SizableText>
        <Switch
          checked={Boolean(value.enabled)}
          onCheckedChange={(enabled) =>
            onSave({ [fieldName]: makeProfileJson({ ...value, enabled }) } as unknown as BusinessProfilePatch)
          }
        />
      </XStack>
      <YStack gap="$2">
        <Label>Title</Label>
        <Input
          defaultValue={value.title ?? ''}
          onBlur={(event) =>
            onSave({
              [fieldName]: makeProfileJson({
                ...value,
                title: (event.currentTarget as HTMLInputElement).value,
              }),
            } as unknown as BusinessProfilePatch)
          }
        />
      </YStack>
    </YStack>
  )
}
