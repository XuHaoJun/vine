import { useActiveParams, useRouter, createRoute } from 'one'
import { memo } from 'react'
import { SizableText, Spinner, XStack, YStack } from 'tamagui'
import { useTanQuery, useTanMutation, useTanQueryClient } from '~/query'
import { oaClient } from '~/features/oa/client'
import { Button } from '~/interface/buttons/Button'
import { Select } from '~/interface/forms/Select'
import { showToast } from '~/interface/toast/Toast'
import { showError } from '~/interface/dialogs/actions'

const route = createRoute<'/(app)/manager/[oaId]/richmenu/users'>()

export const RichMenuUsersPage = memo(() => {
  const params = useActiveParams<{ oaId: string }>()
  const oaId = params.oaId!
  const router = useRouter()
  const qc = useTanQueryClient()

  const { data: menusData } = useTanQuery({
    queryKey: ['oa', 'richmenu-list', oaId],
    queryFn: () => oaClient.listRichMenus({ officialAccountId: oaId }),
    enabled: !!oaId,
  })

  const { data: usersData, isLoading } = useTanQuery({
    queryKey: ['oa', 'richmenu-users-all', oaId],
    queryFn: () => oaClient.listOAUsersWithRichMenus({ officialAccountId: oaId }),
    enabled: !!oaId,
  })

  const linkMutation = useTanMutation({
    mutationFn: ({ userId, richMenuId }: { userId: string; richMenuId: string }) =>
      oaClient.linkRichMenuToUserManager({ officialAccountId: oaId, userId, richMenuId }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['oa', 'richmenu-users-all', oaId] })
      showToast('Menu assigned', { type: 'success' })
    },
    onError: (e) => showError(e, 'Failed to assign menu'),
  })

  const unlinkMutation = useTanMutation({
    mutationFn: (userId: string) =>
      oaClient.unlinkRichMenuFromUserManager({ officialAccountId: oaId, userId }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['oa', 'richmenu-users-all', oaId] })
      showToast('Menu unlinked', { type: 'success' })
    },
    onError: (e) => showError(e, 'Failed to unlink menu'),
  })

  const menus = menusData?.menus ?? []
  const users = usersData?.users ?? []

  return (
    <YStack gap="$6">
      <XStack justify="space-between" items="center">
        <YStack gap="$1">
          <SizableText size="$7" fontWeight="700" color="$color12">
            Per-user rich menus
          </SizableText>
          <SizableText size="$2" color="$color10">
            Assign specific menus to individual users. Overrides the default.
          </SizableText>
        </YStack>
        <Button
          variant="outlined"
          onPress={() => router.navigate(`/manager/${oaId}/richmenu` as any)}
        >
          ← Menus
        </Button>
      </XStack>

      {isLoading ? (
        <YStack items="center" py="$10">
          <Spinner size="large" />
        </YStack>
      ) : users.length === 0 ? (
        <YStack py="$10" items="center" borderWidth={1} borderColor="$borderColor" rounded="$4">
          <SizableText size="$4" color="$color11">
            No users have friended this account yet.
          </SizableText>
        </YStack>
      ) : (
        <YStack gap="$2">
          {users.map((u) => (
            <XStack
              key={u.userId}
              borderWidth={1}
              borderColor="$borderColor"
              rounded="$3"
              p="$3"
              gap="$3"
              items="center"
            >
              <YStack flex={1}>
                <SizableText size="$3" fontWeight="600" color="$color12">
                  {u.userName ?? u.userId}
                </SizableText>
                <SizableText size="$1" color="$color10">
                  {u.assignedRichMenuId
                    ? `Assigned: ${menus.find((m) => m.richMenuId === u.assignedRichMenuId)?.name ?? u.assignedRichMenuId}`
                    : 'Using default'}
                </SizableText>
              </YStack>

              <YStack width={220} shrink={0}>
                <Select
                  value={u.assignedRichMenuId ?? '__default__'}
                  onValueChange={(value) => {
                    if (value === '__default__') {
                      unlinkMutation.mutate(u.userId)
                    } else {
                      linkMutation.mutate({ userId: u.userId, richMenuId: value })
                    }
                  }}
                  options={[
                    { label: 'Use default', value: '__default__' },
                    ...menus.map((m) => ({ label: m.name, value: m.richMenuId })),
                  ]}
                />
              </YStack>
            </XStack>
          ))}
        </YStack>
      )}
    </YStack>
  )
})

export default RichMenuUsersPage
