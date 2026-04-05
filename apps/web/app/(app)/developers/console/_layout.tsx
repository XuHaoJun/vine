import { Link, Slot, usePathname, useRouter } from 'one'
import { Linking } from 'react-native'
import { SizableText, XStack, YStack } from 'tamagui'

import { Button } from '~/interface/buttons/Button'
import { Pressable } from '~/interface/buttons/Pressable'
import { ArrowUpRightIcon } from '~/interface/icons/phosphor/ArrowUpRightIcon'
import { CaretLeftIcon } from '~/interface/icons/phosphor/CaretLeftIcon'
import { HouseIcon } from '~/interface/icons/phosphor/HouseIcon'
import { ListIcon } from '~/interface/icons/phosphor/ListIcon'

const LINE_DEVELOPERS_JA = 'https://developers.line.biz/ja/'
const LINE_DEVELOPERS_EN = 'https://developers.line.biz/en/'

function normalizePath(path: string) {
  const trimmed = path.replace(/\/$/, '')
  return trimmed === '' ? '/' : trimmed
}

export default function DevelopersConsoleLayout() {
  const router = useRouter()
  const pathname = usePathname()
  const path = normalizePath(pathname)

  const handleBack = () => router.back()

  const isConsoleHome = path === '/developers/console'
  const isUnderProvider = path.includes('/developers/console/provider/')
  const isUnderChannel = path.includes('/developers/console/channel/')

  const openLineDocs = () => {
    void Linking.openURL(LINE_DEVELOPERS_JA)
  }

  const openLineDocsEn = () => {
    void Linking.openURL(LINE_DEVELOPERS_EN)
  }

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
          <Pressable
            onPress={openLineDocs}
            p="$2"
            rounded="$2"
            hoverStyle={{ bg: '$backgroundHover' }}
            aria-label="LINE Developers documentation (Japanese)"
          >
            <SizableText size="$2" color="$color10">
              日本語
            </SizableText>
          </Pressable>
          <Pressable
            onPress={openLineDocsEn}
            p="$2"
            rounded="$2"
            hoverStyle={{ bg: '$backgroundHover' }}
            aria-label="LINE Developers documentation (English)"
          >
            <SizableText size="$2" color="$color10">
              English
            </SizableText>
          </Pressable>
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
              <Pressable
                onPress={openLineDocs}
                py="$2"
                px="$3"
                rounded="$3"
                hoverStyle={{ bg: '$color2' }}
              >
                <XStack gap="$3" items="center" justify="space-between">
                  <SizableText size="$3" fontWeight="600" color="$color11">
                    LINE Developers
                  </SizableText>
                  <ArrowUpRightIcon size={16} color="$color10" />
                </XStack>
                <SizableText size="$2" color="$color10" mt="$1">
                  Official API reference and console help
                </SizableText>
              </Pressable>
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
