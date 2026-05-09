import { BusinessProfileImageKind } from '@vine/proto/oa'
import { useCallback, useMemo, useState } from 'react'
import { oaClient } from '~/features/oa/client'
import { useTanMutation, useTanQuery, useTanQueryClient } from '~/query'
import { makeProfileJson } from './clientTypes'
import type { BusinessProfilePatch } from '@vine/proto/oa'

export function useBusinessProfileEditor(oaId: string) {
  const queryClient = useTanQueryClient()
  const queryKey = useMemo(() => ['oa', 'business-profile-editor', oaId], [oaId])
  const [saveError, setSaveError] = useState(false)

  const editor = useTanQuery({
    queryKey,
    queryFn: () => oaClient.getBusinessProfileEditorState({ officialAccountId: oaId }),
    enabled: !!oaId,
  })

  const autosave = useTanMutation({
    mutationFn: (patch: BusinessProfilePatch) =>
      oaClient.autosaveBusinessProfileDraft({
        officialAccountId: oaId,
        patch,
        clientRevision: editor.data?.draft?.serverRevision,
      }),
    onMutate: () => setSaveError(false),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey })
    },
    onError: () => setSaveError(true),
  })

  const reset = useTanMutation({
    mutationFn: () => oaClient.resetBusinessProfileDraft({ officialAccountId: oaId }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  })

  const publish = useTanMutation({
    mutationFn: () =>
      oaClient.publishBusinessProfile({
        officialAccountId: oaId,
        expectedRevision: editor.data?.draft?.serverRevision,
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  })

  const uploadImage = useTanMutation({
    mutationFn: (input: {
      kind: BusinessProfileImageKind
      image: Uint8Array
      contentType: string
    }) =>
      oaClient.uploadBusinessProfileImage({
        officialAccountId: oaId,
        kind: input.kind,
        image: input.image,
        contentType: input.contentType,
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
    onError: () => setSaveError(true),
  })

  const removeImage = useTanMutation({
    mutationFn: (kind: BusinessProfileImageKind) =>
      oaClient.removeBusinessProfileImage({ officialAccountId: oaId, kind }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
    onError: () => setSaveError(true),
  })

  const saveTextField = useCallback(
    (
      key: 'displayName' | 'uniqueId' | 'statusMessage' | 'phoneNumber',
      value: string,
    ) => {
      autosave.mutate({ [key]: value } as unknown as BusinessProfilePatch)
    },
    [autosave],
  )

  const saveJsonField = useCallback(
    (
      key:
        | 'buttons'
        | 'address'
        | 'paymentMethods'
        | 'businessHours'
        | 'websites'
        | 'visibilitySettings'
        | 'announcements'
        | 'mixedMediaFeed'
        | 'socialMedia'
        | 'basicInfoBlock',
      value: unknown,
    ) => {
      autosave.mutate({
        [key]: makeProfileJson(value),
      } as unknown as BusinessProfilePatch)
    },
    [autosave],
  )

  return {
    editor,
    autosave,
    reset,
    publish,
    saveError,
    saveTextField,
    saveJsonField,
    uploadImage,
    removeImage,
  }
}
