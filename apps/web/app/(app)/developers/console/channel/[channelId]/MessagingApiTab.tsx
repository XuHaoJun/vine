import { YStack } from 'tamagui'

import { MessagingApiGuideSection } from './MessagingApiGuideSection'
import { MessagingApiQuotaSection } from './MessagingApiQuotaSection'
import { TestWebhookSection } from './TestWebhookSection'
import { WebhookErrorsSection } from './WebhookErrorsSection'
import { WebhookSettingsSection } from './WebhookSettingsSection'

export function MessagingApiTab({ channelId }: { channelId: string }) {
  return (
    <YStack gap="$6">
      <MessagingApiGuideSection />
      <MessagingApiQuotaSection channelId={channelId} />
      <WebhookSettingsSection channelId={channelId} />
      <WebhookErrorsSection channelId={channelId} />
      <TestWebhookSection channelId={channelId} />
    </YStack>
  )
}
