import { Link, Slot, useActiveParams } from 'one'
import { SizableText, XStack, YStack } from 'tamagui'
import { oaClient } from '~/features/oa/client'
import { Pressable } from '~/interface/buttons/Pressable'
import { useTanQuery } from '~/query'

function normalizePath(path: string) {
  return path.replace(/\/$/, '') || '/'
}

function useBrowserPathname() {
  if (typeof window !== 'undefined') return normalizePath(window.location.pathname)
  return '/'
}

export default function ManagerHomeLayout() {
  const params = useActiveParams<{ oaId: string }>()
  const oaId = params.oaId!
  const path = useBrowserPathname()
  const homePath = `/manager/${oaId}`
  const chatPath = `/manager/${oaId}/chat`
  const richMenuPath = `/manager/${oaId}/richmenu`
  const homeActive = path === homePath
  const richMenuActive = path.startsWith(richMenuPath)

  const summary = useTanQuery({
    queryKey: ['oa', 'manager-summary', oaId],
    queryFn: () => oaClient.getOfficialAccountManagerSummary({ officialAccountId: oaId }),
    enabled: !!oaId,
  })
  const account = summary.data?.account

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
        bg="$background"
        borderBottomWidth={1}
        borderColor="$borderColor"
      >
        <XStack items="center" gap="$3" flex={1}>
          <SizableText size="$4" fontWeight="700" color="$color12">
            Vine Official Account Manager
          </SizableText>
          {account ? (
            <>
              <SizableText size="$3" fontWeight="700" color="$color12">
                {account.name}
              </SizableText>
              <SizableText size="$2" color="$color10">
                @{account.uniqueId}
              </SizableText>
              <SizableText size="$2" color="$color10">
                {summary.data?.friendCount ?? 0} friends
              </SizableText>
              <SizableText size="$2" color="$color10">
                Chat: {summary.data?.chat?.status === 'available' ? 'On' : 'Off'}
              </SizableText>
            </>
          ) : null}
        </XStack>
        <SizableText size="$2" color="$color10">
          Settings
        </SizableText>
      </XStack>

      <XStack
        height="$5"
        px="$4"
        shrink={0}
        items="center"
        gap="$4"
        borderBottomWidth={1}
        borderColor="$borderColor"
      >
        <Link href={homePath as any}>
          <Pressable role="link" py="$3">
            <SizableText size="$2" fontWeight={homeActive ? '700' : '500'}>
              Home
            </SizableText>
          </Pressable>
        </Link>
        <Link href={chatPath as any}>
          <Pressable role="link" py="$3">
            <SizableText size="$2" fontWeight="500">
              Chats
            </SizableText>
          </Pressable>
        </Link>
      </XStack>

      <XStack flex={1} style={{ minHeight: 0 }} $platform-web={{ overflow: 'hidden' }}>
        <YStack
          width={240}
          shrink={0}
          bg="$background"
          borderRightWidth={1}
          borderColor="$borderColor"
          p="$3"
          gap="$2"
          $platform-web={{ overflowY: 'auto' }}
        >
          <SizableText size="$1" fontWeight="700" color="$color9" textTransform="uppercase">
            Chat screen
          </SizableText>
          <Link href={richMenuPath as any}>
            <Pressable
              role="link"
              py="$2"
              px="$3"
              rounded="$3"
              bg={richMenuActive ? '$color3' : 'transparent'}
              hoverStyle={{ bg: richMenuActive ? '$color3' : '$color2' }}
            >
              <SizableText
                size="$2"
                fontWeight={richMenuActive ? '700' : '500'}
                color={richMenuActive ? '$color12' : '$color11'}
              >
                Rich menus
              </SizableText>
            </Pressable>
          </Link>
        </YStack>

        <YStack flex={1} style={{ minHeight: 0 }} $platform-web={{ overflowY: 'auto' }}>
          <YStack p="$6" maxW={1200} width="100%" mx="auto">
            <Slot />
          </YStack>
        </YStack>
      </XStack>
    </YStack>
  )
}
