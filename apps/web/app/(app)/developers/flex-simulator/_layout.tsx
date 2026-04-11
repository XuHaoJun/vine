import { Link, Slot } from 'one'
import { SizableText, XStack, YStack } from 'tamagui'

import { Button } from '~/interface/buttons/Button'

import {
  FlexSimulatorHeaderProvider,
  useFlexSimulatorHeader,
} from './FlexSimulatorHeaderContext'

function FlexSimulatorLayoutInner() {
  const { resetHandler, sendHandler } = useFlexSimulatorHeader()

  return (
    <YStack
      flex={1}
      bg="$background"
      $platform-web={{ height: '100vh', minHeight: '100vh' }}
    >
      <XStack
        height="$6"
        px="$5"
        shrink={0}
        items="center"
        gap="$3"
        bg="$background"
        borderBottomWidth={1}
        borderColor="$borderColor"
      >
        <SizableText size="$6" fontWeight="700" color="$color12">
          Vine Developers
        </SizableText>
        <Link href="/developers/console">
          <Button size="$2" variant="outlined">
            Console
          </Button>
        </Link>
      </XStack>

      <XStack
        height="$5"
        px="$5"
        shrink={0}
        items="center"
        justify="space-between"
        bg="$color2"
        borderBottomWidth={1}
        borderColor="$borderColor"
      >
        <SizableText size="$5" fontWeight="700" color="$color12">
          Flex Simulator
        </SizableText>
        <XStack gap="$2">
          <Button size="$2" onPress={() => resetHandler?.()} disabled={!resetHandler}>
            Reset
          </Button>
          <Button size="$2" onPress={() => sendHandler?.()} disabled={!sendHandler}>
            Send...
          </Button>
        </XStack>
      </XStack>

      <YStack flex={1} style={{ minHeight: 0 }} $platform-web={{ overflowY: 'auto' }}>
        <YStack
          p="$8"
          maxW={1400}
          width="100%"
          mx="auto"
          flex={1}
          style={{ minHeight: 0 }}
        >
          <Slot />
        </YStack>
      </YStack>
    </YStack>
  )
}

export default function FlexSimulatorLayout() {
  return (
    <FlexSimulatorHeaderProvider>
      <FlexSimulatorLayoutInner />
    </FlexSimulatorHeaderProvider>
  )
}
