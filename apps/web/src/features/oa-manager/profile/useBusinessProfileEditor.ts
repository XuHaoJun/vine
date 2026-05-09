import { BusinessProfileImageKind } from '@vine/proto/oa'
import { useCallback, useMemo, useRef, useState } from 'react'
import { oaClient } from '~/features/oa/client'
import { useTanMutation, useTanQuery, useTanQueryClient } from '~/query'
import type { BusinessProfilePatch } from '@vine/proto/oa'

export function useBusinessProfileEditor(oaId: string) {
  const queryClient = useTanQueryClient()
  const queryKey = useMemo(() => ['oa', 'business-profile-editor', oaId], [oaId])
  const [saveError, setSaveError] = useState(false)
  const revisionRef = useRef<number | undefined>(undefined)
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const editor = useTanQuery({
    queryKey,
    queryFn: () => oaClient.getBusinessProfileEditorState({ officialAccountId: oaId }),
    enabled: !!oaId,
  })

  if (
    editor.data?.draft?.serverRevision !== undefined &&
    revisionRef.current === undefined
  ) {
    revisionRef.current = editor.data.draft.serverRevision
  }

  const autosave = useTanMutation({
    mutationFn: (patch: BusinessProfilePatch) =>
      oaClient.autosaveBusinessProfileDraft({
        officialAccountId: oaId,
        patch,
        clientRevision: revisionRef.current,
      }),
    onMutate: () => setSaveError(false),
    onSuccess: (data) => {
      revisionRef.current = data.serverRevision
      queryClient.invalidateQueries({ queryKey })
    },
    onError: () => setSaveError(true),
  })

  const reset = useTanMutation({
    mutationFn: () => oaClient.resetBusinessProfileDraft({ officialAccountId: oaId }),
    onSuccess: (data) => {
      revisionRef.current = data.state?.draft?.serverRevision
      queryClient.invalidateQueries({ queryKey })
    },
  })

  const publish = useTanMutation({
    mutationFn: () =>
      oaClient.publishBusinessProfile({
        officialAccountId: oaId,
        expectedRevision: revisionRef.current,
      }),
    onSuccess: (data) => {
      revisionRef.current = data.state?.draft?.serverRevision
      queryClient.invalidateQueries({ queryKey })
    },
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

  const debouncedAutosave = useCallback(
    (patch: BusinessProfilePatch) => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current)
      debounceTimerRef.current = setTimeout(() => {
        autosave.mutate(patch)
      }, 500)
    },
    [autosave],
  )

  return {
    editor,
    autosave,
    debouncedAutosave,
    reset,
    publish,
    saveError,
    uploadImage,
    removeImage,
  }
}
