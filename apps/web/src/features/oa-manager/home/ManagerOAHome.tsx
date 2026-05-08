import { useRouter } from 'one'
import { WebhookStatus } from '@vine/proto/oa'
import { useEffect } from 'react'
import { Spinner, SizableText, XStack, YStack } from 'tamagui'
import { oaClient } from '~/features/oa/client'
import { Button } from '~/interface/buttons/Button'
import { showError } from '~/interface/dialogs/actions'
import { useTanQuery } from '~/query'
import { OperationCard, SetupChecklist } from './ManagerSummaryCards'

type ManagerOAHomeProps = {
  oaId: string
}

function formatQuota(summary: {
  quota?: { monthlyLimit?: number; totalUsage: number; remaining?: number }
}) {
  const quota = summary.quota
  if (!quota) return 'No quota data'
  if (!quota.monthlyLimit) return `${quota.totalUsage} used`
  return `${quota.totalUsage}/${quota.monthlyLimit} used`
}

export function ManagerOAHome({ oaId }: ManagerOAHomeProps) {
  const router = useRouter()
  const { data, isLoading, isError } = useTanQuery({
    queryKey: ['oa', 'manager-summary', oaId],
    queryFn: () => oaClient.getOfficialAccountManagerSummary({ officialAccountId: oaId }),
    enabled: !!oaId,
  })

  useEffect(() => {
    if (isError) {
      showError(new Error('Account not found or access denied'))
      router.navigate('/manager' as any)
    }
  }, [isError, router])

  if (isLoading) {
    return (
      <YStack items="center" py="$10">
        <Spinner size="large" />
      </YStack>
    )
  }

  if (isError || !data?.account) {
    return (
      <YStack gap="$2">
        <SizableText size="$5" fontWeight="700" color="$color12">
          Account unavailable
        </SizableText>
        <SizableText size="$2" color="$color10">
          This account could not be loaded or you do not have access.
        </SizableText>
      </YStack>
    )
  }

  const account = data.account
  const setupItems = [
    { label: 'Complete profile', complete: data.setup?.profileComplete ?? false },
    { label: 'Add profile image', complete: data.setup?.profileImageAdded ?? false },
    { label: 'Configure webhook', complete: data.setup?.webhookConfigured ?? false },
    {
      label: 'Create default rich menu',
      complete: data.setup?.defaultRichMenuCreated ?? false,
    },
    { label: 'Open chat inbox', complete: data.setup?.chatInboxAvailable ?? false },
  ]

  return (
    <YStack gap="$6">
      <XStack items="center" gap="$4">
        <YStack
          width={72}
          height={72}
          rounded="$12"
          bg="$color3"
          overflow="hidden"
          items="center"
          justify="center"
        >
          {account.imageUrl ? (
            <img src={account.imageUrl} width={72} height={72} alt="" />
          ) : (
            <SizableText size="$7" color="$color9">
              {account.name.slice(0, 1).toUpperCase()}
            </SizableText>
          )}
        </YStack>
        <YStack flex={1} gap="$1">
          <SizableText size="$7" fontWeight="700" color="$color12">
            {account.name}
          </SizableText>
          <SizableText size="$2" color="$color10">
            {data.friendCount} friends - @{account.uniqueId}
          </SizableText>
        </YStack>
        <Button variant="outlined" disabled>
          Edit profile
        </Button>
      </XStack>

      <YStack
        gap="$3"
        $platform-web={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
        }}
      >
        <OperationCard
          title="Chats"
          description="Open the OA inbox and reply to users."
          value={
            data.chat?.recentChatCount
              ? `${data.chat.recentChatCount} recent chats`
              : 'Inbox ready'
          }
          actionLabel="Open chats"
          onPress={() => router.navigate(`/manager/${oaId}/chat` as any)}
        />
        <OperationCard
          title="Rich menus"
          description="Manage the menu shown in the chat screen."
          value={data.richMenu?.defaultRichMenuTitle ?? 'No default menu'}
          actionLabel="Manage"
          onPress={() => router.navigate(`/manager/${oaId}/richmenu` as any)}
        />
        <OperationCard
          title="Messaging API"
          description="Read-only webhook status for Phase 0."
          value={
            data.webhook?.configured
              ? `Webhook ${
                  data.webhook.status === WebhookStatus.VERIFIED
                    ? 'verified'
                    : 'configured'
                }`
              : 'Webhook not configured'
          }
        />
        <OperationCard
          title="Quota"
          description="Read-only monthly message usage."
          value={formatQuota(data)}
        />
      </YStack>

      <XStack gap="$4" items="flex-start" $platform-web={{ flexWrap: 'wrap' }}>
        <YStack flex={2} minW={320}>
          <SetupChecklist items={setupItems} />
        </YStack>
        <YStack flex={1} minW={260} gap="$4">
          <YStack borderWidth={1} borderColor="$borderColor" rounded="$3" p="$4" gap="$2">
            <SizableText size="$4" fontWeight="700" color="$color12">
              Announcements
            </SizableText>
            <SizableText size="$2" color="$color10">
              No announcements yet.
            </SizableText>
          </YStack>
          <YStack borderWidth={1} borderColor="$borderColor" rounded="$3" p="$4" gap="$2">
            <SizableText size="$4" fontWeight="700" color="$color12">
              Help
            </SizableText>
            <SizableText size="$2" color="$color10">
              Vine API docs and setup guidance will appear here.
            </SizableText>
          </YStack>
        </YStack>
      </XStack>
    </YStack>
  )
}
