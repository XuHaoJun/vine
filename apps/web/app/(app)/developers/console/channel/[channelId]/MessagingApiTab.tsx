import { YStack } from 'tamagui'

import { TestWebhookSection } from './TestWebhookSection'
import { WebhookErrorsSection } from './WebhookErrorsSection'
import { WebhookSettingsSection } from './WebhookSettingsSection'
import { createRoute } from 'one'

const route =
  createRoute<'/(app)/developers/console/channel/[channelId]/MessagingApiTab'>()

export function MessagingApiTab({ channelId }: { channelId: string }) {
  return (
    <YStack gap="$6">
      <WebhookSettingsSection channelId={channelId} />
      <WebhookErrorsSection channelId={channelId} />
      <TestWebhookSection channelId={channelId} />
    </YStack>
  )
}
