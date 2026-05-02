import { useActiveParams, useRouter, createRoute } from 'one'
import { memo, useState } from 'react'
import { SizableText, Spinner, XStack, YStack } from 'tamagui'
import { useTanMutation, useTanQuery, useTanQueryClient } from '~/query'

import { oaClient } from '~/features/oa/client'
import { showError } from '~/interface/dialogs/actions'
import { showToast } from '~/interface/toast/Toast'
import { Input } from '~/interface/forms/Input'
import { Button } from '~/interface/buttons/Button'
import { RichMenuEditor } from '~/features/oa-manager/richmenu/RichMenuEditor'
import { boundsFromProto } from '~/features/oa-manager/richmenu/types'
import type { Area, EditorState, MenuSize } from '~/features/oa-manager/richmenu/types'

const route = createRoute<'/(app)/manager/[oaId]/richmenu/[richMenuId]'>()

export const EditRichMenuPage = memo(() => {
  const params = useActiveParams<{ oaId: string; richMenuId: string }>()
  const oaId = params.oaId!
  const richMenuId = params.richMenuId!
  const router = useRouter()
  const qc = useTanQueryClient()

  const { data, isLoading } = useTanQuery({
    queryKey: ['oa', 'richmenu', oaId, richMenuId],
    queryFn: () => oaClient.getRichMenu({ officialAccountId: oaId, richMenuId }),
    enabled: !!oaId && !!richMenuId,
  })

  const handleSaved = () => {
    qc.invalidateQueries({ queryKey: ['oa', 'richmenu-list', oaId] })
    qc.invalidateQueries({ queryKey: ['oa', 'richmenu', oaId, richMenuId] })
    router.navigate(`/manager/${oaId}/richmenu` as any)
  }

  if (isLoading || !data?.menu) {
    return (
      <YStack flex={1} items="center" py="$10">
        <Spinner size="large" />
      </YStack>
    )
  }

  const menu = data.menu
  const size: MenuSize =
    menu.sizeWidth === 2500 && menu.sizeHeight === 843 ? '2500x843' : '2500x1686'

  let imageDataUrl: string | null = null
  if (data.image?.length) {
    const base64 = btoa(
      Array.from(data.image)
        .map((b) => String.fromCharCode(b))
        .join(''),
    )
    const mime = data.imageContentType || 'image/jpeg'
    imageDataUrl = `data:${mime};base64,${base64}`
  }

  const areas: Area[] = menu.areas.map((a, i) => ({
    id: `area-${i}`,
    bounds: boundsFromProto(a.bounds!),
    action: {
      type: (a.action?.type ?? 'message') as any,
      text: a.action?.text,
      uri: a.action?.uri,
      data: a.action?.data,
      displayText: a.action?.displayText,
      label: a.action?.label,
      richMenuAliasId: a.action?.richMenuAliasId,
    } as any,
  }))

  const initial: EditorState = {
    name: menu.name,
    size,
    chatBarText: menu.chatBarText,
    selected: menu.selected,
    areas,
    selectedAreaId: null,
    imageDataUrl,
    imageChanged: false,
  }

  return (
    <YStack gap="$4">
      <SizableText size="$7" fontWeight="700" color="$color12">
        Edit Rich Menu
      </SizableText>
      <RichMenuEditor
        mode="edit"
        oaId={oaId}
        richMenuId={richMenuId}
        initial={initial}
        onSaved={handleSaved}
      />
      <AliasesSection oaId={oaId} richMenuId={richMenuId} />
    </YStack>
  )
})

const AliasesSection = memo(({ oaId, richMenuId }: { oaId: string; richMenuId: string }) => {
  const qc = useTanQueryClient()
  const [newAliasId, setNewAliasId] = useState('')

  const { data, isLoading } = useTanQuery({
    queryKey: ['oa', 'richmenu-aliases', oaId, richMenuId],
    queryFn: () => oaClient.listRichMenuAliases({ officialAccountId: oaId }),
    enabled: !!oaId && !!richMenuId,
  })

  const createMutation = useTanMutation({
    mutationFn: (aliasId: string) =>
      oaClient.createRichMenuAlias({
        officialAccountId: oaId,
        richMenuAliasId: aliasId,
        richMenuId,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['oa', 'richmenu-aliases', oaId, richMenuId] })
      setNewAliasId('')
      showToast('Alias created', { type: 'success' })
    },
    onError: (e) => showError(e, 'Failed to create alias'),
  })

  const deleteMutation = useTanMutation({
    mutationFn: (aliasId: string) =>
      oaClient.deleteRichMenuAliasManager({
        officialAccountId: oaId,
        richMenuAliasId: aliasId,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['oa', 'richmenu-aliases', oaId, richMenuId] })
      showToast('Alias deleted', { type: 'success' })
    },
    onError: (e) => showError(e, 'Failed to delete alias'),
  })

  const aliases = data?.aliases ?? []

  return (
    <YStack gap="$3" borderWidth={1} borderColor="$borderColor" rounded="$3" p="$4">
      <SizableText size="$5" fontWeight="700" color="$color12">
        Aliases
      </SizableText>
      <SizableText size="$2" color="$color10">
        Aliases let rich menu areas use the richmenuswitch action to switch between menus.
      </SizableText>

      {isLoading ? (
        <Spinner size="small" />
      ) : aliases.length === 0 ? (
        <SizableText size="$2" color="$color9">
          No aliases yet.
        </SizableText>
      ) : (
        <YStack gap="$2">
          {aliases.map((alias) => (
            <XStack
              key={alias.richMenuAliasId}
              items="center"
              justify="space-between"
              borderWidth={1}
              borderColor="$borderColor"
              rounded="$2"
              px="$3"
              py="$2"
            >
              <SizableText size="$3" fontWeight="600" color="$color12">
                {alias.richMenuAliasId}
              </SizableText>
              <Button
                size="$2"
                variant="outlined"
                theme="red"
                onPress={() => deleteMutation.mutate(alias.richMenuAliasId)}
              >
                Delete
              </Button>
            </XStack>
          ))}
        </YStack>
      )}

      <XStack gap="$2" items="flex-end">
        <YStack flex={1} gap="$1">
          <SizableText size="$1" color="$color10">
            New alias ID
          </SizableText>
          <Input
            value={newAliasId}
            onChangeText={setNewAliasId}
            placeholder="richmenu-alias-a"
          />
        </YStack>
        <Button
          onPress={() => {
            if (newAliasId.trim()) createMutation.mutate(newAliasId.trim())
          }}
          disabled={!newAliasId.trim() || createMutation.isPending}
        >
          Add
        </Button>
      </XStack>
    </YStack>
  )
})

export default EditRichMenuPage
