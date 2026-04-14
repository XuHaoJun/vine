import { useActiveParams, useRouter, createRoute } from 'one'
import { memo } from 'react'
import { Image } from 'react-native'
import { SizableText, Spinner, XStack, YStack } from 'tamagui'

import { dialogConfirm, showError } from '~/interface/dialogs/actions'
import { showToast } from '~/interface/toast/Toast'
import { Button } from '~/interface/buttons/Button'
import { useTanMutation, useTanQuery, useTanQueryClient } from '~/query'
import { oaClient } from '~/features/oa/client'

const route = createRoute<'/(app)/manager/[oaId]/richmenu'>()

// Shows the image thumbnail if hasImage is true, otherwise a "No image" box
const RichMenuThumbnail = memo(
  ({
    oaId,
    richMenuId,
    hasImage,
  }: {
    oaId: string
    richMenuId: string
    hasImage: boolean
  }) => {
    const { data } = useTanQuery({
      queryKey: ['oa', 'richmenu', oaId, richMenuId],
      queryFn: () => oaClient.getRichMenu({ officialAccountId: oaId, richMenuId }),
      enabled: hasImage,
    })

    if (!hasImage || !data?.image?.length) {
      return (
        <YStack
          width={80}
          height={46}
          bg="$color3"
          rounded="$2"
          items="center"
          justify="center"
          shrink={0}
        >
          <SizableText size="$1" color="$color9">
            No image
          </SizableText>
        </YStack>
      )
    }

    const base64 = btoa(
      Array.from(data.image)
        .map((b) => String.fromCharCode(b))
        .join(''),
    )
    const mimeType = data.imageContentType || 'image/jpeg'
    const uri = `data:${mimeType};base64,${base64}`

    return (
      <YStack
        width={80}
        height={46}
        rounded="$2"
        overflow="hidden"
        bg="$color3"
        shrink={0}
      >
        <Image source={{ uri }} style={{ width: 80, height: 46 }} resizeMode="cover" />
      </YStack>
    )
  },
)

export const RichMenuListPage = memo(() => {
  const params = useActiveParams<{ oaId: string }>()
  const oaId = params.oaId!
  const router = useRouter()
  const qc = useTanQueryClient()

  const { data, isLoading } = useTanQuery({
    queryKey: ['oa', 'richmenu-list', oaId],
    queryFn: () => oaClient.listRichMenus({ officialAccountId: oaId }),
    enabled: !!oaId,
  })

  const setDefaultMutation = useTanMutation({
    mutationFn: (richMenuId: string) =>
      oaClient.setDefaultRichMenu({ officialAccountId: oaId, richMenuId }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['oa', 'richmenu-list', oaId] })
      showToast('Default menu updated', { type: 'success' })
    },
    onError: (e) => showError(e, 'Failed to set default'),
  })

  const deleteMutation = useTanMutation({
    mutationFn: (richMenuId: string) =>
      oaClient.deleteRichMenu({ officialAccountId: oaId, richMenuId }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['oa', 'richmenu-list', oaId] })
      showToast('Menu deleted', { type: 'success' })
    },
    onError: (e) => showError(e, 'Failed to delete menu'),
  })

  const handleDelete = async (richMenuId: string, name: string) => {
    const confirmed = await dialogConfirm({
      title: `Delete "${name}"?`,
      description: 'This cannot be undone.',
    })
    if (confirmed) deleteMutation.mutate(richMenuId)
  }

  if (isLoading) {
    return (
      <YStack flex={1} items="center" py="$10">
        <Spinner size="large" />
      </YStack>
    )
  }

  const menus = data?.menus ?? []
  const defaultId = data?.defaultRichMenuId
  const defaultMenu = defaultId
    ? menus.find((m) => m.richMenuId === defaultId)
    : undefined
  const otherMenus = menus.filter((m) => m.richMenuId !== defaultId)

  return (
    <YStack gap="$6">
      {/* Page header */}
      <XStack justify="space-between" items="center">
        <YStack gap="$1">
          <SizableText size="$7" fontWeight="700" color="$color12">
            Rich menus
          </SizableText>
          <SizableText size="$2" color="$color10">
            Create custom menus shown in the chat screen
          </SizableText>
        </YStack>
        <Button
          onPress={() => router.navigate(`/manager/${oaId}/richmenu/create` as any)}
        >
          + Create
        </Button>
      </XStack>

      {/* Empty state */}
      {menus.length === 0 && (
        <YStack
          py="$10"
          items="center"
          gap="$3"
          borderWidth={1}
          borderColor="$borderColor"
          rounded="$4"
        >
          <SizableText size="$4" color="$color11" fontWeight="600">
            No rich menus yet
          </SizableText>
          <SizableText size="$2" color="$color10">
            Create a menu and set it as default to show it to all users automatically.
          </SizableText>
        </YStack>
      )}

      {/* Default menu */}
      {defaultMenu && (
        <YStack gap="$2">
          <SizableText
            size="$1"
            fontWeight="700"
            color="$color9"
            textTransform="uppercase"
          >
            Default menu
          </SizableText>
          <MenuCard
            menu={defaultMenu}
            oaId={oaId}
            isDefault
            onEdit={() =>
              router.navigate(
                `/manager/${oaId}/richmenu/${defaultMenu.richMenuId}` as any,
              )
            }
            onDelete={() => handleDelete(defaultMenu.richMenuId, defaultMenu.name)}
          />
        </YStack>
      )}

      {/* Other menus */}
      {otherMenus.length > 0 && (
        <YStack gap="$2">
          <SizableText
            size="$1"
            fontWeight="700"
            color="$color9"
            textTransform="uppercase"
          >
            Other menus
          </SizableText>
          {otherMenus.map((menu) => (
            <MenuCard
              key={menu.richMenuId}
              menu={menu}
              oaId={oaId}
              isDefault={false}
              onSetDefault={() => setDefaultMutation.mutate(menu.richMenuId)}
              onEdit={() =>
                router.navigate(`/manager/${oaId}/richmenu/${menu.richMenuId}` as any)
              }
              onDelete={() => handleDelete(menu.richMenuId, menu.name)}
            />
          ))}
        </YStack>
      )}
    </YStack>
  )
})

type MenuCardProps = {
  menu: {
    richMenuId: string
    name: string
    areas: unknown[]
    sizeWidth: number
    sizeHeight: number
    chatBarText: string
    hasImage: boolean
  }
  oaId: string
  isDefault: boolean
  onSetDefault?: () => void
  onEdit: () => void
  onDelete: () => void
}

const MenuCard = memo(
  ({ menu, oaId, isDefault, onSetDefault, onEdit, onDelete }: MenuCardProps) => (
    <XStack
      borderWidth={1}
      borderColor="$borderColor"
      rounded="$3"
      p="$3"
      gap="$3"
      items="center"
      bg={isDefault ? '$green1' : '$background'}
    >
      <RichMenuThumbnail
        oaId={oaId}
        richMenuId={menu.richMenuId}
        hasImage={menu.hasImage}
      />

      <YStack flex={1} gap="$1">
        <SizableText size="$3" fontWeight="600" color="$color12">
          {menu.name}
        </SizableText>
        <SizableText size="$1" color="$color10">
          {menu.areas.length} areas · {menu.sizeWidth}×{menu.sizeHeight} · "
          {menu.chatBarText}"
        </SizableText>
      </YStack>

      <XStack gap="$2" items="center">
        {isDefault && (
          <YStack px="$2" py="$1" rounded="$2" bg="$green3">
            <SizableText size="$1" fontWeight="700" color="$green10">
              DEFAULT
            </SizableText>
          </YStack>
        )}
        {!isDefault && onSetDefault && (
          <Button size="$2" variant="outlined" onPress={onSetDefault}>
            Set default
          </Button>
        )}
        <Button size="$2" onPress={onEdit}>
          Edit
        </Button>
        <Button size="$2" variant="outlined" theme="red" onPress={onDelete}>
          Delete
        </Button>
      </XStack>
    </XStack>
  ),
)

export default RichMenuListPage
