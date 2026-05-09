import { useActiveParams, createRoute } from 'one'
import { memo } from 'react'
import { YStack, Text, Spinner } from 'tamagui'
import { oaClient } from '~/features/oa/client'
import { OADetailContent } from '~/interface/oa/OADetailContent'
import { useTanQuery } from '~/query'

const route = createRoute<'/(app)/oa/[oaId]'>()

export const OADetailPage = memo(() => {
  const { oaId } = useActiveParams<{ oaId: string }>()

  const { data, isLoading, error } = useTanQuery({
    queryKey: ['oa', 'resolve', oaId],
    queryFn: () => oaClient.resolveOfficialAccount({ uniqueId: oaId! }),
    enabled: !!oaId,
  })

  if (isLoading) {
    return (
      <YStack flex={1} items="center" justify="center" bg="$background">
        <Spinner size="large" />
      </YStack>
    )
  }

  if (error || !data?.account) {
    return (
      <YStack flex={1} items="center" justify="center" bg="$background" gap="$3">
        <Text fontSize={16} fontWeight="600" color="$color12">
          找不到此官方帳號
        </Text>
        <Text fontSize={13} color="$color10">
          請確認 QR Code 或連結是否正確
        </Text>
      </YStack>
    )
  }

  const oa = data.account

  return (
    <YStack flex={1} bg="$background">
      <OADetailContent
        id={oa.id}
        name={oa.name}
        oaId={oa.uniqueId}
        imageUrl={oa.imageUrl || undefined}
        coverImageUrl={oa.coverImageUrl || undefined}
        description={oa.statusMessage || undefined}
        showCloseButton={false}
      />
    </YStack>
  )
})

export default OADetailPage
