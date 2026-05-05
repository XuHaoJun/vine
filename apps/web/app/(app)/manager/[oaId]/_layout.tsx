import { Slot, usePathname, useRouter, Link, useActiveParams } from 'one'
import { useEffect } from 'react'
import { SizableText, Spinner, Stack, Text, XStack, YStack } from 'tamagui'

import { showError } from '~/interface/dialogs/actions'
import { Pressable } from '~/interface/buttons/Pressable'
import { useTanQuery } from '~/query'
import { oaClient } from '~/features/oa/client'
import { miniAppClient } from '~/features/mini-app/client'

function normalizePath(path: string) {
  return path.replace(/\/$/, '') || '/'
}

export default function ManagerLayout() {
  const params = useActiveParams<{ oaId: string }>()
  const oaId = params.oaId
  const router = useRouter()
  const pathname = usePathname()
  const path = normalizePath(pathname)

  const {
    data: accountData,
    isLoading,
    isError,
  } = useTanQuery({
    queryKey: ['oa', 'account', oaId],
    queryFn: () => oaClient.getOfficialAccount({ id: oaId! }),
    enabled: !!oaId,
  })

  useEffect(() => {
    if (isError) {
      showError(new Error('Account not found or access denied'))
      router.navigate('/developers/console')
    }
  }, [isError, router])

  if (isLoading) {
    return (
      <YStack flex={1} items="center" justify="center">
        <Spinner size="large" />
      </YStack>
    )
  }

  const oa = accountData?.account
  const isRichMenuActive = path.includes('/richmenu')

  const linkedApps = useTanQuery({
    queryKey: ['miniApp', 'linkedToOa', oaId],
    queryFn: () => miniAppClient.listLinkedToOa({ oaId: oaId! }),
    enabled: !!oaId,
  })

  return (
    <YStack
      flex={1}
      bg="$background"
      $platform-web={{ height: '100vh', minHeight: '100vh' }}
    >
      {/* Header */}
      <XStack
        height="$6"
        px="$5"
        shrink={0}
        items="center"
        bg="$background"
        borderBottomWidth={1}
        borderColor="$borderColor"
      >
        <SizableText size="$4" fontWeight="700" color="$color12">
          LINE Official Account Manager
          {oa ? ` · ${oa.name}` : ''}
        </SizableText>
      </XStack>

      <XStack flex={1} style={{ minHeight: 0 }} $platform-web={{ overflow: 'hidden' }}>
        {/* Sidebar */}
        <YStack
          width={200}
          shrink={0}
          bg="$background"
          borderRightWidth={1}
          borderColor="$borderColor"
          $platform-web={{ overflowY: 'auto' }}
          p="$3"
          gap="$4"
        >
          <YStack gap="$1">
            <SizableText
              size="$1"
              fontWeight="700"
              color="$color9"
              textTransform="uppercase"
              mb="$2"
            >
              Chat screen
            </SizableText>
            <Link href={`/manager/${oaId}/richmenu` as any}>
              <Pressable
                role="link"
                py="$2"
                px="$3"
                rounded="$3"
                bg={isRichMenuActive ? '$color3' : 'transparent'}
                hoverStyle={{ bg: isRichMenuActive ? '$color3' : '$color2' }}
              >
                <SizableText
                  size="$2"
                  fontWeight={isRichMenuActive ? '700' : '500'}
                  color={isRichMenuActive ? '$color12' : '$color11'}
                >
                  Rich menus
                </SizableText>
              </Pressable>
            </Link>
          </YStack>

          {linkedApps.data?.miniApps.length ? (
            <YStack gap="$1" mt="$3">
              <Text size="$1" fontWeight="700" color="$color9" textTransform="uppercase" mb="$2">
                Linked Mini Apps
              </Text>
              {linkedApps.data.miniApps.map((m) => (
                <Pressable
                  key={m.id}
                  py="$2"
                  px="$3"
                  rounded="$3"
                  hoverStyle={{ bg: '$color2' }}
                  onPress={() => router.push(`/m/${m.id}` as any)}
                >
                  <XStack items="center" gap="$2">
                    <Stack w={20} h={20} rounded="$1" overflow="hidden" bg="$color3">
                      {m.iconUrl && <img src={m.iconUrl} width={20} height={20} alt="" />}
                    </Stack>
                    <Text size="$2" fontWeight="500" color="$color11">
                      {m.name}
                    </Text>
                  </XStack>
                </Pressable>
              ))}
              <Text size="$1" color="$color9" px="$3" mt="$1">
                To edit linked Mini Apps, go to the developer console for the Mini App.
              </Text>
            </YStack>
          ) : null}
        </YStack>

        {/* Main content */}
        <YStack flex={1} style={{ minHeight: 0 }} $platform-web={{ overflowY: 'auto' }}>
          <YStack p="$6" maxW={1120} width="100%" mx="auto">
            <Slot />
          </YStack>
        </YStack>
      </XStack>
    </YStack>
  )
}
