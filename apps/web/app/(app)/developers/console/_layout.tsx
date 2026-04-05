import { Link, Slot, usePathname, useRouter } from 'one'
import { Linking } from 'react-native'
import { SizableText, XStack, YStack } from 'tamagui'

import { Pressable } from '~/interface/buttons/Pressable'
import { ArrowUpRightIcon } from '~/interface/icons/phosphor/ArrowUpRightIcon'
import { HouseIcon } from '~/interface/icons/phosphor/HouseIcon'
import { ListIcon } from '~/interface/icons/phosphor/ListIcon'

function normalizePath(path: string) {
  const trimmed = path.replace(/\/$/, '')
  return trimmed === '' ? '/' : trimmed
}

export default function DevelopersConsoleLayout() {
  const pathname = usePathname()
  const path = normalizePath(pathname)

  const isConsoleHome = path === '/developers/console'
  const isUnderProvider = path.includes('/developers/console/provider/')
  const isUnderChannel = path.includes('/developers/console/channel/')

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
        justify="space-between"
        bg="$background"
        borderBottomWidth={1}
        borderColor="$borderColor"
      >
        <XStack items="center" gap="$4">
          <SizableText size="$6" fontWeight="700" color="$color12">
            Vine Developers
          </SizableText>
        </XStack>
      </XStack>

      <XStack flex={1} style={{ minHeight: 0 }} $platform-web={{ overflow: 'hidden' }}>
        <YStack
          width={260}
          shrink={0}
          bg="$background"
          borderRightWidth={1}
          borderColor="$borderColor"
          $platform-web={{ overflowY: 'auto' }}
        >
          <YStack p="$4" gap="$5">
            <YStack gap="$2">
              <SizableText
                size="$1"
                fontWeight="700"
                color="$color9"
                textTransform="uppercase"
              >
                Console
              </SizableText>
              <Link href="/developers/console">
                <Pressable
                  role="link"
                  py="$2"
                  px="$3"
                  rounded="$3"
                  bg={isConsoleHome ? '$color3' : 'transparent'}
                  hoverStyle={{ bg: isConsoleHome ? '$color3' : '$color2' }}
                  aria-current={isConsoleHome ? 'page' : undefined}
                >
                  <XStack gap="$3" items="center">
                    <HouseIcon
                      size={18}
                      color={isConsoleHome ? '$color12' : '$color10'}
                    />
                    <SizableText
                      size="$3"
                      fontWeight={isConsoleHome ? '700' : '600'}
                      color={isConsoleHome ? '$color12' : '$color11'}
                    >
                      TOP
                    </SizableText>
                  </XStack>
                </Pressable>
              </Link>
            </YStack>

            <YStack gap="$2">
              <XStack gap="$2" items="center">
                <ListIcon size={16} color="$color9" />
                <SizableText
                  size="$1"
                  fontWeight="700"
                  color="$color9"
                  textTransform="uppercase"
                >
                  Providers
                </SizableText>
              </XStack>
              <SizableText size="$2" color="$color10" lineHeight="$1">
                Create and manage providers, then add channels from the provider screen.
              </SizableText>
              <YStack
                mt="$2"
                p="$3"
                rounded="$3"
                bg="$color2"
                borderWidth={1}
                borderColor="$borderColor"
                gap="$2"
              >
                <SizableText size="$2" fontWeight="600" color="$color11">
                  Where you are
                </SizableText>
                <SizableText size="$2" color="$color10">
                  {isConsoleHome && 'Provider list (TOP)'}
                  {isUnderProvider && 'Provider · channels'}
                  {isUnderChannel && 'Channel settings'}
                  {!isConsoleHome && !isUnderProvider && !isUnderChannel && 'Console'}
                </SizableText>
              </YStack>
            </YStack>

            <YStack gap="$2">
              <SizableText
                size="$1"
                fontWeight="700"
                color="$color9"
                textTransform="uppercase"
              >
                Resources
              </SizableText>
            </YStack>
          </YStack>
        </YStack>

        <YStack flex={1} style={{ minHeight: 0 }} $platform-web={{ overflowY: 'auto' }}>
          <YStack p="$8" maxW={1120} width="100%" mx="auto">
            <Slot />
          </YStack>
        </YStack>
      </XStack>
    </YStack>
  )
}
