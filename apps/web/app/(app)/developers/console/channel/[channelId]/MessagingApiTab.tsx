import { YStack } from 'tamagui'

import { AccessTokenSection } from './AccessTokenSection'
import { MessagingApiGuideSection } from './MessagingApiGuideSection'
import { MessagingApiQuotaSection } from './MessagingApiQuotaSection'
import { TestWebhookSection } from './TestWebhookSection'
import { WebhookErrorsSection } from './WebhookErrorsSection'
import { WebhookSettingsSection } from './WebhookSettingsSection'
import { createRoute } from 'one'

const route =
  createRoute<'/(app)/developers/console/channel/[channelId]/MessagingApiTab'>()

export function MessagingApiTab({ channelId }: { channelId: string }) {
  return (
    <YStack gap="$6">
      <AccessTokenSection channelId={channelId} />
      <MessagingApiGuideSection />
      <MessagingApiQuotaSection channelId={channelId} />
      <WebhookSettingsSection channelId={channelId} />
      <WebhookErrorsSection channelId={channelId} />
      <TestWebhookSection channelId={channelId} />
    </YStack>
  )
}
