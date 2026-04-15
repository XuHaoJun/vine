// apps/web/app/(app)/developers/console/login-channel/[loginChannelId]/index.tsx
import { useActiveParams, useRouter, createRoute } from 'one'
import { memo, useState } from 'react'
import { SizableText, Spinner, XStack, YStack } from 'tamagui'
import { useTanQuery } from '~/query'
import { loginChannelClient } from '~/features/liff/client'
import { Button } from '~/interface/buttons/Button'
import { CaretLeftIcon } from '~/interface/icons/phosphor/CaretLeftIcon'

const route = createRoute<'/(app)/developers/console/login-channel/[loginChannelId]'>()

export const LoginChannelSettingsPage = memo(() => {
  const params = useActiveParams<{ loginChannelId: string }>()
  const router = useRouter()
  const loginChannelId = params.loginChannelId
  const [activeTab, setActiveTab] = useState<'settings' | 'liff'>('settings')

  const { data: channel, isLoading } = useTanQuery({
    queryKey: ['liff', 'login-channel', loginChannelId],
    queryFn: () => loginChannelClient.getLoginChannel({ id: loginChannelId! }),
    enabled: !!loginChannelId,
  })

  const { data: secret } = useTanQuery({
    queryKey: ['liff', 'login-channel-secret', loginChannelId],
    queryFn: () => loginChannelClient.getLoginChannelSecret({ id: loginChannelId! }),
    enabled: !!loginChannelId,
  })

  if (isLoading) {
    return (
      <YStack flex={1} items="center" justify="center">
        <Spinner size="large" />
      </YStack>
    )
  }

  const chan = channel?.channel

  return (
    <YStack gap="$6">
      {/* Breadcrumb */}
      <XStack items="center" gap="$2">
        <Button
          variant="transparent"
          circular
          onPress={() => router.back()}
          icon={<CaretLeftIcon size={16} />}
          aria-label="Back"
        />
        <SizableText size="$2" color="$color10" fontWeight="500">
          Provider
        </SizableText>
        <SizableText size="$2" color="$color10">›</SizableText>
        <SizableText size="$2" color="$color12" fontWeight="700">
          {chan?.name ?? 'Login Channel'}
        </SizableText>
      </XStack>

      {/* Header */}
      <YStack gap="$2">
        <SizableText size="$8" fontWeight="700" color="$color12">
          {chan?.name ?? 'Login Channel'}
        </SizableText>
        <XStack px="$2" py="$0.5" bg="$blue9" rounded="$1" self="flex-start">
          <SizableText size="$1" color="white" fontWeight="700">LINE Login</SizableText>
        </XStack>
      </YStack>

      {/* Tabs */}
      <XStack gap="$6" borderBottomWidth={1} borderColor="$borderColor" pb="$2">
        <SizableText
          size="$3"
          fontWeight={activeTab === 'settings' ? '700' : '400'}
          color={activeTab === 'settings' ? '$color12' : '$color10'}
          cursor="pointer"
          onPress={() => setActiveTab('settings')}
        >
          Settings
        </SizableText>
        <SizableText
          size="$3"
          fontWeight={activeTab === 'liff' ? '700' : '400'}
          color={activeTab === 'liff' ? '$color12' : '$color10'}
          cursor="pointer"
          onPress={() => router.push(`/developers/console/login-channel/${loginChannelId}/liff` as never)}
        >
          LIFF
        </SizableText>
      </XStack>

      {/* Settings Tab Content */}
      <YStack gap="$4">
        <YStack gap="$1">
          <SizableText size="$2" color="$color10" fontWeight="500">Channel ID</SizableText>
          <SizableText size="$3" color="$color12" fontFamily="$mono">
            {secret?.secret?.channelId ?? chan?.channelId ?? '—'}
          </SizableText>
        </YStack>

        <YStack gap="$1">
          <SizableText size="$2" color="$color10" fontWeight="500">Channel Secret</SizableText>
          <SizableText size="$3" color="$color12" fontFamily="$mono">
            {secret?.secret?.channelSecret ?? '••••••••••••••••'}
          </SizableText>
        </YStack>

        <YStack gap="$1">
          <SizableText size="$2" color="$color10" fontWeight="500">Provider ID</SizableText>
          <SizableText size="$3" color="$color12" fontFamily="$mono">
            {chan?.providerId ?? '—'}
          </SizableText>
        </YStack>

        {chan?.description && (
          <YStack gap="$1">
            <SizableText size="$2" color="$color10" fontWeight="500">Description</SizableText>
            <SizableText size="$3" color="$color12">{chan.description}</SizableText>
          </YStack>
        )}
      </YStack>
    </YStack>
  )
})

export default LoginChannelSettingsPage
