import { useActiveParams, useRouter, createRoute } from 'one'
import { memo } from 'react'
import { SizableText, Spinner, YStack } from 'tamagui'
import { useTanQuery, useTanQueryClient } from '~/query'

import { oaClient } from '~/features/oa/client'
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
    const base64 = btoa(Array.from(data.image).map((b) => String.fromCharCode(b)).join(''))
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
    </YStack>
  )
})

export default EditRichMenuPage
