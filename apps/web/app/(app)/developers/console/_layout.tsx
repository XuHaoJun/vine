import { Slot, useRouter } from 'one'
import { memo } from 'react'
import { ScrollView, SizableText, XStack, YStack } from 'tamagui'

import { Button } from '~/interface/buttons/Button'
import { CaretLeftIcon } from '~/interface/icons/phosphor/CaretLeftIcon'

export const DevelopersConsoleLayout = memo(() => {
  const router = useRouter()

  const handleBack = () => router.back()

  return (
    <YStack flex={1} bg="$background" $platform-web={{ height: '100vh' }}>
      {/* Top Nav */}
      <XStack
        height="$6"
        px="$5"
        items="center"
        justify="space-between"
        bg="$background"
        borderBottomWidth={1}
        borderColor="$borderColor"
      >
        <XStack items="center" gap="$4">
          <Button
            variant="transparent"
            circular
            onPress={handleBack}
            icon={<CaretLeftIcon size={20} />}
            aria-label="Back"
          />
          <SizableText size="$6" fontWeight="700" color="$color12">
            Vine Developers
          </SizableText>
        </XStack>
        <XStack items="center" gap="$3">
          <SizableText size="$2" color="$color10">
            日本語
          </SizableText>
        </XStack>
      </XStack>

      <XStack flex={1} $platform-web={{ overflow: 'hidden' }}>
        {/* Sidebar */}
        <YStack
          width={240}
          bg="$background"
          borderRightWidth={1}
          borderColor="$borderColor"
          shrink={0}
        >
          <YStack p="$4" gap="$3">
            <SizableText
              size="$2"
              fontWeight="600"
              color="$color10"
              cursor="pointer"
              hoverStyle={{ color: '$color' }}
            >
              Console home
            </SizableText>
            <SizableText size="$2" fontWeight="700" color="$color" mt="$2">
              Providers
            </SizableText>
          </YStack>
        </YStack>

        {/* Main Content */}
        <YStack flex={1} $platform-web={{ overflowY: 'auto' }}>
          <ScrollView>
            <YStack p="$8" maxW={960} mx="auto">
              <Slot />
            </YStack>
          </ScrollView>
        </YStack>
      </XStack>
    </YStack>
  )
})

export default DevelopersConsoleLayout
