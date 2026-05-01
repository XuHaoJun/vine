import { useActiveParams, useRouter, createRoute } from 'one'
import { useState } from 'react'
import { SizableText, Spinner, XStack, YStack } from 'tamagui'

import { useTanMutation, useTanQuery } from '~/query'
import { oaClient } from '~/features/oa/client'
import { Button } from '~/interface/buttons/Button'
import { showToast } from '~/interface/toast/Toast'

import { ChannelHeader } from './ChannelHeader'
import { MessagingApiTab } from './MessagingApiTab'

const route = createRoute<'/(app)/developers/console/channel/[channelId]'>()

export const ChannelSettingsPage = () => {
  const params = useActiveParams<{ channelId: string }>()
  const router = useRouter()
  const channelId = params.channelId
  const [isEditing, setIsEditing] = useState(false)
  const [editName, setEditName] = useState('')
  const [editDescription, setEditDescription] = useState('')
  const [activeTab, setActiveTab] = useState<'basic' | 'messaging'>('basic')

  const { data: account, isLoading } = useTanQuery({
    queryKey: ['oa', 'account', channelId],
    queryFn: () => oaClient.getOfficialAccount({ id: channelId! }),
    enabled: !!channelId,
  })

  const { data: webhook } = useTanQuery({
    queryKey: ['oa', 'webhook', channelId],
    queryFn: () => oaClient.getWebhook({ officialAccountId: channelId! }),
    enabled: !!channelId,
  })

  const { data: secret } = useTanQuery({
    queryKey: ['oa', 'account-secret', channelId],
    queryFn: () => oaClient.getOfficialAccountSecret({ id: channelId! }),
    enabled: !!channelId,
  })

  const updateAccount = useTanMutation({
    mutationFn: (input: { name?: string; description?: string }) =>
      oaClient.updateOfficialAccount({
        id: channelId!,
        ...input,
      }),
    onSuccess: () => {
      showToast('Channel updated', { type: 'success' })
      setIsEditing(false)
    },
    onError: () => {
      showToast('Failed to update channel', { type: 'error' })
    },
  })

  const handleSave = () => {
    const updates: { name?: string; description?: string } = {}
    if (editName.trim() && editName !== account?.account?.name) {
      updates.name = editName.trim()
    }
    if (editDescription.trim() && editDescription !== account?.account?.description) {
      updates.description = editDescription.trim()
    }
    if (Object.keys(updates).length > 0) {
      updateAccount.mutate(updates)
    } else {
      setIsEditing(false)
    }
  }

  const handleEdit = () => {
    setEditName(account?.account?.name ?? '')
    setEditDescription(account?.account?.description ?? '')
    setIsEditing(true)
  }

  const handleCancel = () => {
    setIsEditing(false)
  }

  if (isLoading) {
    return (
      <YStack flex={1} items="center" py="$10">
        <Spinner size="large" />
      </YStack>
    )
  }

  const oa = account?.account
  if (!oa) return null

  return (
    <YStack gap="$6">
      <ChannelHeader account={oa} />

      <XStack gap="$6" borderBottomWidth={1} borderColor="$borderColor" pb="$2">
        <SizableText
          size="$3"
          fontWeight={activeTab === 'basic' ? '700' : '400'}
          color={activeTab === 'basic' ? '$color12' : '$color10'}
          cursor="pointer"
          onPress={() => setActiveTab('basic')}
        >
          Basic settings
        </SizableText>
        <SizableText
          size="$3"
          fontWeight={activeTab === 'messaging' ? '700' : '400'}
          color={activeTab === 'messaging' ? '$color12' : '$color10'}
          cursor="pointer"
          onPress={() => setActiveTab('messaging')}
        >
          Messaging API
        </SizableText>
        <SizableText size="$3" color="$color10">
          LIFF
        </SizableText>
        <SizableText size="$3" color="$color10">
          Security
        </SizableText>
        <SizableText size="$3" color="$color10">
          Roles
        </SizableText>
      </XStack>

      {activeTab === 'basic' ? (
        <YStack gap="$6">
          <SizableText size="$5" fontWeight="700" color="$color12">
            Basic settings
          </SizableText>

          <YStack gap="$4">
            <SizableText size="$4" fontWeight="600" color="$color11">
              Basic information
            </SizableText>
            <SizableText size="$2" color="$color10">
              You can change your app name and icon in LINE Official Account Manager.
            </SizableText>
          </YStack>

          {/* Channel ID */}
          <YStack py="$3" px="$4" borderWidth={1} borderColor="$borderColor" rounded="$2">
            <XStack justify="space-between" items="center">
              <SizableText size="$2" color="$color10" fontWeight="500">
                Channel ID
              </SizableText>
              <SizableText size="$2" color="$color12" fontWeight="500">
                {oa.id}
              </SizableText>
            </XStack>
          </YStack>

          {/* Channel Icon */}
          <YStack py="$3" px="$4" borderWidth={1} borderColor="$borderColor" rounded="$2">
            <XStack justify="space-between" items="center">
              <SizableText size="$2" color="$color10" fontWeight="500">
                Channel icon
              </SizableText>
              <YStack
                width={48}
                height={48}
                rounded="$2"
                bg="$color5"
                items="center"
                justify="center"
              >
                <SizableText size="$2" color="$color10">
                  Large Icon
                </SizableText>
              </YStack>
            </XStack>
          </YStack>

          {/* Channel Name */}
          <YStack py="$3" px="$4" borderWidth={1} borderColor="$borderColor" rounded="$2">
            <XStack justify="space-between" items="center">
              <SizableText size="$2" color="$color10" fontWeight="500">
                Channel name
              </SizableText>
              {isEditing ? (
                <SizableText size="$2" color="$color12" fontWeight="500">
                  {editName || oa.name}
                </SizableText>
              ) : (
                <SizableText size="$2" color="$color12" fontWeight="500">
                  {oa.name}
                </SizableText>
              )}
            </XStack>
          </YStack>

          {/* Channel Description */}
          <YStack py="$3" px="$4" borderWidth={1} borderColor="$borderColor" rounded="$2">
            <XStack justify="space-between" items="center">
              <SizableText size="$2" color="$color10" fontWeight="500">
                Channel description
              </SizableText>
              {isEditing ? (
                <SizableText size="$2" color="$color12" fontWeight="500" text="right">
                  {editDescription || oa.description || '(empty)'}
                </SizableText>
              ) : (
                <SizableText size="$2" color="$color12" fontWeight="500" text="right">
                  {oa.description || '(empty)'}
                </SizableText>
              )}
            </XStack>
          </YStack>

          {/* Channel Secret */}
          <YStack py="$3" px="$4" borderWidth={1} borderColor="$borderColor" rounded="$2">
            <XStack justify="space-between" items="center">
              <SizableText size="$2" color="$color10" fontWeight="500">
                Channel secret
              </SizableText>
              <SizableText size="$2" color="$color12" fontWeight="500" fontFamily="$mono">
                {secret?.secret?.channelSecret
                  ? `${secret.secret.channelSecret.slice(0, 8)}...`
                  : '••••••••'}
              </SizableText>
            </XStack>
          </YStack>

          {/* Webhook URL */}
          <YStack py="$3" px="$4" borderWidth={1} borderColor="$borderColor" rounded="$2">
            <XStack justify="space-between" items="center">
              <SizableText size="$2" color="$color10" fontWeight="500">
                Webhook URL
              </SizableText>
              <SizableText size="$2" color="$color12" fontWeight="500">
                {webhook?.webhook?.url ?? 'Not configured'}
              </SizableText>
            </XStack>
          </YStack>

          {/* Edit Button */}
          {isEditing ? (
            <XStack gap="$3" justify="flex-end">
              <Button variant="outlined" onPress={handleCancel}>
                Cancel
              </Button>
              <Button onPress={handleSave} disabled={updateAccount.isPending}>
                Save
              </Button>
            </XStack>
          ) : (
            <XStack gap="$3" justify="flex-end">
              <Button
                variant="outlined"
                onPress={() => router.navigate(`/manager/${oa.id}/richmenu` as any)}
              >
                Manage →
              </Button>
              <Button onPress={handleEdit}>Edit</Button>
            </XStack>
          )}
        </YStack>
      ) : (
        <MessagingApiTab channelId={channelId!} />
      )}
    </YStack>
  )
}

export default ChannelSettingsPage
