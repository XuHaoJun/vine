import { useActiveParams, useRouter, createRoute } from 'one'
import { memo } from 'react'
import { SizableText, YStack } from 'tamagui'
import { useTanQueryClient } from '~/query'

import { RichMenuEditor } from '~/features/oa-manager/richmenu/RichMenuEditor'

const route = createRoute<'/(app)/manager/[oaId]/richmenu/create'>()

export const CreateRichMenuPage = memo(() => {
  const params = useActiveParams<{ oaId: string }>()
  const oaId = params.oaId!
  const router = useRouter()
  const qc = useTanQueryClient()

  const handleSaved = (richMenuId: string) => {
    qc.invalidateQueries({ queryKey: ['oa', 'richmenu-list', oaId] })
    router.navigate(`/manager/${oaId}/richmenu` as any)
  }

  return (
    <YStack gap="$4">
      <SizableText size="$7" fontWeight="700" color="$color12">
        Create Rich Menu
      </SizableText>
      <RichMenuEditor mode="create" oaId={oaId} onSaved={handleSaved} />
    </YStack>
  )
})

export default CreateRichMenuPage
