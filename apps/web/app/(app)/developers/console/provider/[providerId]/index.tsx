import { useActiveParams, useRouter, createRoute } from 'one'
import { memo, useState } from 'react'
import { SizableText, Spinner, XStack, YStack } from 'tamagui'

import { useTanMutation, useTanQuery, useTanQueryClient } from '~/query'
import { oaClient } from '~/features/oa/client'
import { loginChannelClient } from '~/features/liff/client'
import { Button } from '~/interface/buttons/Button'
import { CaretLeftIcon } from '~/interface/icons/phosphor/CaretLeftIcon'
import { Input } from '~/interface/forms/Input'
import { showToast } from '~/interface/toast/Toast'

const route = createRoute<'/(app)/developers/console/provider/[providerId]'>()

const CHANNEL_TYPE_LABELS: Record<string, string> = {
  messaging_api: 'Messaging API',
  line_login: 'LINE Login',
  liff: 'LIFF',
  mini_app: 'LINE MINI App',
}

export const ChannelListPage = memo(() => {
  const params = useActiveParams<{ providerId: string }>()
  const router = useRouter()
  const queryClient = useTanQueryClient()
  const providerId = params.providerId
  const [showCreate, setShowCreate] = useState(false)
  const [newChannelName, setNewChannelName] = useState('')
  const [newChannelOaId, setNewChannelOaId] = useState('')

  const { data: provider } = useTanQuery({
    queryKey: ['oa', 'provider', providerId],
    queryFn: () => oaClient.getProvider({ id: providerId }),
  })

  const { data: channels, isLoading } = useTanQuery({
    queryKey: ['oa', 'channels', providerId],
    queryFn: () => oaClient.listProviderAccounts({ providerId }),
    enabled: !!providerId,
  })

  const { data: loginChannels, isLoading: loginChannelsLoading } = useTanQuery({
    queryKey: ['liff', 'login-channels', providerId],
    queryFn: () => loginChannelClient.listLoginChannels({ providerId: providerId! }),
    enabled: !!providerId,
  })

  const [showCreateLogin, setShowCreateLogin] = useState(false)
  const [newLoginChannelName, setNewLoginChannelName] = useState('')

  const createLoginChannel = useTanMutation({
    mutationFn: (input: { providerId: string; name: string }) =>
      loginChannelClient.createLoginChannel({
        providerId: input.providerId,
        name: input.name,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ['liff', 'login-channels', providerId],
      })
      showToast('Login channel created', { type: 'success' })
      setShowCreateLogin(false)
      setNewLoginChannelName('')
    },
    onError: () => {
      showToast('Failed to create login channel', { type: 'error' })
    },
  })

  const createChannel = useTanMutation({
    mutationFn: (input: { providerId: string; name: string; uniqueId: string }) =>
      oaClient.createOfficialAccount({
        providerId: input.providerId,
        name: input.name,
        uniqueId: input.uniqueId,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['oa', 'channels', providerId] })
      showToast('Channel created', { type: 'success' })
      setShowCreate(false)
      setNewChannelName('')
      setNewChannelOaId('')
    },
    onError: () => {
      showToast('Failed to create channel', { type: 'error' })
    },
  })

  const handleCreate = () => {
    if (!newChannelName.trim() || !newChannelOaId.trim() || !providerId) return
    createChannel.mutate({
      providerId,
      name: newChannelName.trim(),
      uniqueId: newChannelOaId.trim().startsWith('@')
        ? newChannelOaId.trim()
        : `@${newChannelOaId.trim()}`,
    })
  }

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
          TOP
        </SizableText>
        <SizableText size="$2" color="$color10">
          ›
        </SizableText>
        <SizableText size="$2" color="$color12" fontWeight="700">
          {provider?.provider?.name ?? 'Provider'}
        </SizableText>
      </XStack>

      {/* Page Header */}
      <YStack gap="$4">
        <SizableText size="$8" fontWeight="700" color="$color12">
          {provider?.provider?.name ?? 'Provider'}
        </SizableText>

        {/* Tabs */}
        <XStack gap="$6" borderBottomWidth={1} borderColor="$borderColor" pb="$2">
          <SizableText size="$3" fontWeight="700" color="$color12">
            Channels
          </SizableText>
          <SizableText size="$3" color="$color10" cursor="pointer">
            Roles
          </SizableText>
          <SizableText size="$3" color="$color10" cursor="pointer">
            Settings
          </SizableText>
        </XStack>
      </YStack>

      {/* Channel Grid */}
      {isLoading ? (
        <YStack items="center" py="$10">
          <Spinner size="large" />
        </YStack>
      ) : (
        <YStack>
          <XStack justify="space-between" items="center" mb="$4">
            <SizableText size="$3" fontWeight="600" color="$color10">
              Channels ({channels?.accounts?.length ?? 0})
            </SizableText>
            <Button size="$2" onPress={() => setShowCreate(!showCreate)}>
              Create Channel
            </Button>
          </XStack>

          {/* Create Form */}
          {showCreate && (
            <YStack
              gap="$3"
              p="$4"
              mb="$4"
              borderWidth={1}
              borderColor="$borderColor"
              rounded="$2"
              bg="$background"
            >
              <SizableText size="$3" fontWeight="600" color="$color12">
                New Channel
              </SizableText>
              <Input
                value={newChannelName}
                onChangeText={setNewChannelName}
                placeholder="Channel name"
                size="$2"
              />
              <Input
                value={newChannelOaId}
                onChangeText={setNewChannelOaId}
                placeholder="OA ID (e.g., @mybot)"
                size="$2"
              />
              <XStack gap="$2" justify="flex-end">
                <Button size="$2" variant="outlined" onPress={() => setShowCreate(false)}>
                  Cancel
                </Button>
                <Button
                  size="$2"
                  onPress={handleCreate}
                  disabled={createChannel.isPending}
                >
                  Create
                </Button>
              </XStack>
            </YStack>
          )}

          {/* Channel Cards Grid */}
          <XStack flexWrap="wrap" gap="$4">
            {/* Create Card */}
            <YStack
              width={220}
              height={240}
              borderWidth={1}
              borderColor="$borderColor"
              rounded="$3"
              items="center"
              justify="center"
              gap="$3"
              cursor="pointer"
              hoverStyle={{ bg: '$backgroundHover' }}
              onPress={() => setShowCreate(!showCreate)}
            >
              <SizableText size="$8" color="$color8">
                +
              </SizableText>
              <SizableText size="$2" color="$color10" fontWeight="500">
                Create a new channel
              </SizableText>
            </YStack>

            {/* Channel Cards */}
            {channels?.accounts?.map((account) => (
              <YStack
                key={account.id}
                width={220}
                height={240}
                borderWidth={1}
                borderColor="$borderColor"
                rounded="$3"
                position="relative"
                cursor="pointer"
                hoverStyle={{ shadowColor: '$shadowColor', shadowRadius: 8 }}
                onPress={() =>
                  router.push(`/developers/console/channel/${account.id}` as never)
                }
              >
                {/* Admin Badge */}
                <XStack
                  position="absolute"
                  t="$2"
                  r="$2"
                  px="$2"
                  py="$0.5"
                  bg="$green9"
                  rounded="$1"
                >
                  <SizableText size="$1" color="white" fontWeight="700">
                    Admin
                  </SizableText>
                </XStack>

                <YStack flex={1} items="center" justify="center" gap="$4" pt="$6">
                  {/* Icon Placeholder */}
                  <YStack
                    width={64}
                    height={64}
                    rounded="$10"
                    bg="$color5"
                    items="center"
                    justify="center"
                    borderWidth={2}
                    borderColor="$borderColor"
                  >
                    <SizableText size="$6" fontWeight="700" color="$color11">
                      {account.name.charAt(0).toUpperCase()}
                    </SizableText>
                  </YStack>

                  <SizableText size="$3" fontWeight="700" color="$color12" text="center">
                    {account.name}
                  </SizableText>

                  <XStack gap="$1.5" items="center">
                    <SizableText size="$2" color="$color10" fontWeight="500">
                      Messaging API
                    </SizableText>
                  </XStack>
                </YStack>
              </YStack>
            ))}
          </XStack>
        </YStack>
      )}

      {/* Login Channels Section */}
      <YStack mt="$6">
        <XStack justify="space-between" items="center" mb="$4">
          <SizableText size="$3" fontWeight="600" color="$color10">
            LINE Login Channels ({loginChannels?.channels?.length ?? 0})
          </SizableText>
          <Button size="$2" onPress={() => setShowCreateLogin(!showCreateLogin)}>
            Create Login Channel
          </Button>
        </XStack>

        {showCreateLogin && (
          <YStack
            gap="$3"
            p="$4"
            mb="$4"
            borderWidth={1}
            borderColor="$borderColor"
            rounded="$2"
            bg="$background"
          >
            <SizableText size="$3" fontWeight="600" color="$color12">
              New Login Channel
            </SizableText>
            <Input
              value={newLoginChannelName}
              onChangeText={setNewLoginChannelName}
              placeholder="Channel name"
              size="$2"
            />
            <XStack gap="$2" justify="flex-end">
              <Button
                size="$2"
                variant="outlined"
                onPress={() => setShowCreateLogin(false)}
              >
                Cancel
              </Button>
              <Button
                size="$2"
                onPress={() => {
                  if (!newLoginChannelName.trim() || !providerId) return
                  createLoginChannel.mutate({
                    providerId,
                    name: newLoginChannelName.trim(),
                  })
                }}
                disabled={createLoginChannel.isPending}
              >
                Create
              </Button>
            </XStack>
          </YStack>
        )}

        <XStack flexWrap="wrap" gap="$4">
          {loginChannels?.channels?.map((ch) => (
            <YStack
              key={ch.id}
              width={220}
              height={240}
              borderWidth={1}
              borderColor="$borderColor"
              rounded="$3"
              position="relative"
              cursor="pointer"
              hoverStyle={{ shadowColor: '$shadowColor', shadowRadius: 8 }}
              onPress={() =>
                router.push(`/developers/console/login-channel/${ch.id}` as never)
              }
            >
              <XStack
                position="absolute"
                t="$2"
                r="$2"
                px="$2"
                py="$0.5"
                bg="$blue9"
                rounded="$1"
              >
                <SizableText size="$1" color="white" fontWeight="700">
                  LINE Login
                </SizableText>
              </XStack>
              <YStack flex={1} items="center" justify="center" gap="$4" pt="$6">
                <YStack
                  width={64}
                  height={64}
                  rounded="$10"
                  bg="$color5"
                  items="center"
                  justify="center"
                  borderWidth={2}
                  borderColor="$borderColor"
                >
                  <SizableText size="$6" fontWeight="700" color="$color11">
                    {ch.name.charAt(0).toUpperCase()}
                  </SizableText>
                </YStack>
                <SizableText size="$3" fontWeight="700" color="$color12" text="center">
                  {ch.name}
                </SizableText>
                <XStack gap="$1.5" items="center">
                  <SizableText size="$2" color="$color10" fontWeight="500">
                    LINE Login
                  </SizableText>
                </XStack>
              </YStack>
            </YStack>
          ))}
        </XStack>
      </YStack>
    </YStack>
  )
})

export default ChannelListPage
