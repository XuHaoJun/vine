import { useRouter } from 'one'
import { useEffect, useRef, useState } from 'react'
import { Spinner, SizableText, XStack, YStack } from 'tamagui'
import { Button } from '~/interface/buttons/Button'
import { AccountPageHeader } from './AccountPageHeader'
import { BusinessProfileForm } from './BusinessProfileForm'
import { BusinessProfilePreview } from './BusinessProfilePreview'
import { ProfileBlockEditors } from './ProfileBlockEditors'
import { getBusinessProfileSaveStatus } from './saveStatus'
import { useBusinessProfileEditor } from './useBusinessProfileEditor'
import type { EditorSection } from './clientTypes'
import type { BusinessProfile, BusinessProfilePatch } from '@vine/proto/oa'

type Props = { oaId: string }

export function BusinessProfileEditor({ oaId }: Props) {
  const router = useRouter()
  const [selected, setSelected] = useState<EditorSection>('businessProfile')
  const editor = useBusinessProfileEditor(oaId)
  const data = editor.editor.data

  const [localDraft, setLocalDraft] = useState<BusinessProfile | undefined>(undefined)
  const initializedRef = useRef(false)

  useEffect(() => {
    if (data?.draft && !initializedRef.current) {
      setLocalDraft(data.draft)
      initializedRef.current = true
    }
  }, [data?.draft])

  if (editor.editor.isLoading || !data?.draft || !localDraft) {
    return (
      <YStack items="center" justify="center" flex={1}>
        <Spinner size="large" />
      </YStack>
    )
  }

  const status = getBusinessProfileSaveStatus({
    isSaving: editor.autosave.isPending,
    isError: editor.saveError,
    isDirty: data.isDirty,
  })

  function handleSave(patch: BusinessProfilePatch) {
    setLocalDraft((prev) => {
      if (!prev) return prev
      const next = { ...prev }
      for (const [k, v] of Object.entries(patch)) {
        if (v !== undefined) (next as any)[k] = v
      }
      return next
    })
    editor.debouncedAutosave(patch)
  }

  function handleImmediateSave(patch: BusinessProfilePatch) {
    setLocalDraft((prev) => {
      if (!prev) return prev
      const next = { ...prev }
      for (const [k, v] of Object.entries(patch)) {
        if (v !== undefined) (next as any)[k] = v
      }
      return next
    })
    editor.autosave.mutate(patch)
  }

  return (
    <YStack flex={1} minH={0}>
      <AccountPageHeader
        account={data.account}
        onBack={() => router.navigate(`/manager/${oaId}` as any)}
      />
      <XStack
        height="$6"
        px="$5"
        items="center"
        borderBottomWidth={1}
        borderColor="$borderColor"
      >
        <SizableText size="$4" fontWeight="700">
          Business profile settings
        </SizableText>
        <XStack flex={1} />
        <SizableText
          size="$2"
          color={
            status.tone === 'danger'
              ? '$red10'
              : status.tone === 'muted'
                ? '$color10'
                : '$green10'
          }
        >
          {status.label}
        </SizableText>
        <Button
          ml="$3"
          disabled={!data.isDirty || editor.autosave.isPending || editor.saveError}
          onPress={() => editor.publish.mutate()}
        >
          Publish
        </Button>
      </XStack>
      <XStack flex={1} minH={0}>
        <BusinessProfilePreview
          draft={localDraft}
          selected={selected}
          onSelect={setSelected}
        />
        <YStack flex={1} p="$6" $platform-web={{ overflowY: 'auto' }}>
          {selected === 'businessProfile' ? (
            <BusinessProfileForm
              draft={localDraft}
              onSave={handleSave}
              onImmediateSave={handleImmediateSave}
              onUploadImage={(input) => editor.uploadImage.mutate(input)}
              onRemoveImage={(kind) => editor.removeImage.mutate(kind)}
            />
          ) : (
            <ProfileBlockEditors
              section={selected}
              draft={localDraft}
              onSave={handleImmediateSave}
            />
          )}
        </YStack>
      </XStack>
    </YStack>
  )
}
