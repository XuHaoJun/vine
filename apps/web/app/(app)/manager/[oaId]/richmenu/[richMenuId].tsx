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

  const { data: statsData, isLoading: statsLoading } = useTanQuery({
    queryKey: ['oa', 'richmenu-stats', oaId, richMenuId],
    queryFn: () => oaClient.getRichMenuStats({ officialAccountId: oaId, richMenuId }),
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

  const stats = statsData?.stats ?? []
  const clickCountsByArea = Object.fromEntries(
    stats.map((s) => [s.areaIndex, s.clickCount]),
  ) as Record<number, number>

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
        clickCountsByArea={clickCountsByArea}
        onSaved={handleSaved}
      />
      <AliasesSection oaId={oaId} richMenuId={richMenuId} />
      <AssignedUsersSection oaId={oaId} richMenuId={richMenuId} />
      <ClickStatsSection
        areaCount={areas.length}
        stats={stats}
        isLoading={statsLoading}
      />
    </YStack>
  )
})

const AssignedUsersSection = memo(
  ({ oaId, richMenuId }: { oaId: string; richMenuId: string }) => {
    const qc = useTanQueryClient()

    const { data, isLoading } = useTanQuery({
      queryKey: ['oa', 'richmenu-users', oaId, richMenuId],
      queryFn: () =>
        oaClient.listOAUsersWithRichMenus({
          officialAccountId: oaId,
          richMenuId,
        }),
      enabled: !!oaId && !!richMenuId,
    })

    const unlinkMutation = useTanMutation({
      mutationFn: (userId: string) =>
        oaClient.unlinkRichMenuFromUserManager({ officialAccountId: oaId, userId }),
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: ['oa', 'richmenu-users', oaId, richMenuId] })
        showToast('User unlinked', { type: 'success' })
      },
      onError: (e) => showError(e, 'Failed to unlink user'),
    })

    const users = data?.users ?? []

    return (
      <YStack gap="$3" borderWidth={1} borderColor="$borderColor" rounded="$3" p="$4">
        <SizableText size="$5" fontWeight="700" color="$color12">
          Assigned users
        </SizableText>
        <SizableText size="$2" color="$color10">
          Users with this menu assigned explicitly (overrides the default).
        </SizableText>

        {isLoading ? (
          <Spinner size="small" />
        ) : users.length === 0 ? (
          <SizableText size="$2" color="$color9">
            No users assigned to this menu.
          </SizableText>
        ) : (
          <YStack gap="$2">
            {users.map((u) => (
              <XStack
                key={u.userId}
                items="center"
                justify="space-between"
                borderWidth={1}
                borderColor="$borderColor"
                rounded="$2"
                px="$3"
                py="$2"
              >
                <SizableText size="$3" color="$color12">
                  {u.userName ?? u.userId}
                </SizableText>
                <Button
                  size="$2"
                  variant="outlined"
                  onPress={() => unlinkMutation.mutate(u.userId)}
                >
                  Unlink
                </Button>
              </XStack>
            ))}
          </YStack>
        )}
      </YStack>
    )
  },
)

const ClickStatsSection = memo(
  ({
    areaCount,
    stats,
    isLoading,
  }: {
    areaCount: number
    stats: Array<{ areaIndex: number; clickCount: number }>
    isLoading: boolean
  }) => {
    const total = stats.reduce((sum, s) => sum + s.clickCount, 0)

    const AREA_LABELS = 'ABCDEFGHIJKLMNOPQRST'

    return (
      <YStack gap="$3" borderWidth={1} borderColor="$borderColor" rounded="$3" p="$4">
        <SizableText size="$5" fontWeight="700" color="$color12">
          Click stats
        </SizableText>

        {isLoading ? (
          <Spinner size="small" />
        ) : stats.length === 0 ? (
          <SizableText size="$2" color="$color9">
            No clicks recorded yet.
          </SizableText>
        ) : (
          <YStack gap="$1">
            {Array.from({ length: areaCount }, (_, i) => {
              const stat = stats.find((s) => s.areaIndex === i)
              const count = stat?.clickCount ?? 0
              const pct = total > 0 ? Math.round((count / total) * 100) : 0
              return (
                <XStack key={i} items="center" gap="$3" py="$1">
                  <SizableText size="$2" fontWeight="600" color="$color11" width={24}>
                    {AREA_LABELS[i] ?? String(i + 1)}
                  </SizableText>
                  <SizableText size="$2" color="$color12" width={48}>
                    {count}
                  </SizableText>
                  <SizableText size="$1" color="$color9">
                    {pct}%
                  </SizableText>
                </XStack>
              )
            })}
            <SizableText size="$1" color="$color10" mt="$1">
              Total: {total}
            </SizableText>
          </YStack>
        )}
      </YStack>
    )
  },
)

const AliasesSection = memo(
  ({ oaId, richMenuId }: { oaId: string; richMenuId: string }) => {
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
          Aliases let rich menu areas use the richmenuswitch action to switch between
          menus.
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
  },
)

export default EditRichMenuPage
