import { useRouter } from 'one'
import { SizableText, XStack, YStack } from 'tamagui'
import type { OfficialAccount } from '@vine/proto/oa'

import { Button } from '~/interface/buttons/Button'
import { CaretLeftIcon } from '~/interface/icons/phosphor/CaretLeftIcon'

export function ChannelHeader({ account }: { account: OfficialAccount }) {
  const router = useRouter()
  return (
    <YStack gap="$4">
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
        <SizableText size="$2" color="$color10" fontWeight="500">
          Provider
        </SizableText>
        <SizableText size="$2" color="$color10">
          ›
        </SizableText>
        <SizableText size="$2" color="$color12" fontWeight="700">
          {account.name}
        </SizableText>
      </XStack>

      <XStack items="center" gap="$4">
        <YStack
          width={48}
          height={48}
          rounded="$10"
          bg="$color5"
          items="center"
          justify="center"
          borderWidth={2}
          borderColor="$borderColor"
        >
          <SizableText size="$5" fontWeight="700" color="$color11">
            {account.name.charAt(0).toUpperCase()}
          </SizableText>
        </YStack>
        <YStack gap="$1">
          <SizableText size="$6" fontWeight="700" color="$color12">
            {account.name}
          </SizableText>
          <SizableText size="$2" color="$color10">
            Messaging API
          </SizableText>
        </YStack>
      </XStack>
    </YStack>
  )
}
