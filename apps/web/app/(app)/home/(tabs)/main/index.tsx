import { router } from 'one'
import { memo, useState } from 'react'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { ListItem, ScrollView, SizableText, XStack, YStack } from 'tamagui'

import { useFriends } from '~/features/chat/useFriendship'
import { useAuth } from '~/features/auth/client/authClient'
import { oaClient } from '~/features/oa/client'
import { useTanQuery } from '~/query'
import { useOADetailSheet } from '~/interface/dialogs/OADetailSheet'
import { useOAScannerSheet } from '~/interface/dialogs/OAScannerSheet'
import { Avatar } from '~/interface/avatars/Avatar'
import { BellIcon } from '~/interface/icons/phosphor/BellIcon'
import { BookmarkIcon } from '~/interface/icons/phosphor/BookmarkIcon'
import { CarIcon } from '~/interface/icons/phosphor/CarIcon'
import { GamepadIcon } from '~/interface/icons/phosphor/GamepadIcon'
import { GearIcon } from '~/interface/icons/phosphor/GearIcon'
import { MagnifyingGlassIcon } from '~/interface/icons/phosphor/MagnifyingGlassIcon'
import { MusicNoteIcon } from '~/interface/icons/phosphor/MusicNoteIcon'
import { PaintRollerIcon } from '~/interface/icons/phosphor/PaintRollerIcon'
import { PlayIcon } from '~/interface/icons/phosphor/PlayIcon'
import { QrCodeIcon } from '~/interface/icons/phosphor/QrCodeIcon'
import { SmileIcon } from '~/interface/icons/phosphor/SmileIcon'
import { UserPlusIcon } from '~/interface/icons/phosphor/UserPlusIcon'
import { SearchInput } from '~/interface/forms/SearchInput'
import { showToast } from '~/interface/toast/Toast'

import type { IconProps } from '~/interface/icons/types'

type ServiceItem = {
  icon: React.FC<IconProps>
  label: string
}

const services: ServiceItem[] = [
  { icon: SmileIcon, label: '貼圖' },
  { icon: PaintRollerIcon, label: '主題' },
  { icon: CarIcon, label: 'LINE GO' },
  { icon: PlayIcon, label: 'LINE TV' },
  { icon: MusicNoteIcon, label: '鈴聲' },
  { icon: GamepadIcon, label: 'LINE GAME' },
]

export const MainPage = memo(() => {
  const { user } = useAuth()
  const { friends } = useFriends()
  const insets = useSafeAreaInsets()
  const [searchQuery, setSearchQuery] = useState('')
  const { openDetail, DetailSheetComponent } = useOADetailSheet()
  const { openScanner, ScannerSheetComponent } = useOAScannerSheet()

  const { data: recommendedOAs } = useTanQuery({
    queryKey: ['oa', 'recommended'],
    queryFn: () => oaClient.recommendOfficialAccounts({ limit: 15 }),
  })

  const { data: oaFriends } = useTanQuery({
    queryKey: ['oa', 'myFriends'],
    queryFn: () => oaClient.listMyOAFriends({}),
  })

  const friendCount = friends?.length ?? 0
  const groupCount = 0

  const filteredFriends =
    friends?.filter((f) => {
      if (!searchQuery) return true
      const userId = user?.id ?? ''
      const otherUser = f.requesterId === userId ? f.addressee : f.requester
      const name = otherUser?.name ?? ''
      return name.toLowerCase().includes(searchQuery.toLowerCase())
    }) ?? []

  const handleServicePress = (label: string) => {
    showToast('Coming soon', { type: 'info' })
  }

  return (
    <YStack flex={1} bg="$background">
      {/* Top Action Bar */}
      <XStack justify="flex-end" items="center" px="$4" py="$3" gap="$4">
        <TopBarButton icon={BookmarkIcon} label="Bookmarks" />
        <TopBarButton icon={BellIcon} label="Notifications" />
        <TopBarButton icon={UserPlusIcon} label="Add Friend" />
        <TopBarButton
          icon={GearIcon}
          label="Settings"
          onPress={() => router.push('/home/main/settings' as any)}
        />
      </XStack>

      <ScrollView pb={insets.bottom}>
        {/* User Profile */}
        <XStack px="$4" py="$2" items="center">
          <Avatar size={64} image={user?.image ?? null} name={user?.name ?? 'User'} />
          <YStack ml="$4" flex={1}>
            <SizableText size="$6" fontWeight="700" color="$color12">
              {user?.name ?? 'User'}
            </SizableText>
            <SizableText size="$2" color="$color10" mt="$1">
              Add a status message
            </SizableText>
          </YStack>
        </XStack>

        {/* Search Bar */}
        <XStack px="$4" py="$3" items="center">
          <YStack
            flex={1}
            bg="$color3"
            rounded="$4"
            px="$3"
            py="$2"
            items="center"
            flexDirection="row"
          >
            <MagnifyingGlassIcon size={18} color="$color10" />
            <SearchInput
              flex={1}
              ml="$2"
              placeholder="Search"
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            <YStack
              ml="$2"
              onPress={() => openScanner((oa) => openDetail(oa))}
              cursor="pointer"
            >
              <QrCodeIcon size={18} color="$color10" />
            </YStack>
          </YStack>
        </XStack>

        {/* Friends & Groups */}
        <YStack px="$4" py="$4">
          <SizableText size="$5" fontWeight="700" color="$color12" mb="$2">
            好友與群組
          </SizableText>

          {/* Friends */}
          <ListItem py="$2" cursor="pointer" onPress={() => router.push('/home/talks')}>
            <XStack flex={1} items="center">
              <YStack
                width={48}
                height={48}
                rounded={100}
                bg="$color3"
                overflow="hidden"
                items="center"
                justify="center"
                shrink={0}
              >
                <Avatar size={48} image={null} name="Friends" />
              </YStack>
              <YStack ml="$3" flex={1}>
                <SizableText size="$4" color="$color12">
                  好友
                </SizableText>
                <SizableText size="$3" color="$color10" numberOfLines={1}>
                  {friendCount > 0
                    ? filteredFriends
                        .slice(0, 4)
                        .map((f) => {
                          const userId = user?.id ?? ''
                          const other =
                            f.requesterId === userId ? f.addressee : f.requester
                          return other?.name ?? ''
                        })
                        .filter(Boolean)
                        .join(', ')
                    : 'Celine, Mark, Sarah, Dave...'}
                </SizableText>
              </YStack>
            </XStack>
            <XStack items="center" gap="$1">
              <SizableText size="$3" color="$color10">
                {friendCount}
              </SizableText>
            </XStack>
          </ListItem>

          {/* OA Friends */}
          {oaFriends?.friendships && oaFriends.friendships.length > 0 && (
            <ListItem
              py="$2"
              cursor="pointer"
              onPress={() => router.push('/home/talks')}
              hoverStyle={{ bg: '$backgroundHover' }}
            >
              <XStack flex={1} items="center">
                <YStack
                  width={48}
                  height={48}
                  rounded={100}
                  bg="$color3"
                  overflow="hidden"
                  items="center"
                  justify="center"
                  shrink={0}
                >
                  <Avatar size={48} image={null} name="OA" />
                </YStack>
                <YStack ml="$3" flex={1}>
                  <SizableText size="$4" color="$color12">
                    官方帳號
                  </SizableText>
                  <SizableText size="$3" color="$color10" numberOfLines={1}>
                    {oaFriends.friendships
                      .slice(0, 4)
                      .map((f) => f.oaName)
                      .join(', ')}
                  </SizableText>
                </YStack>
              </XStack>
              <XStack items="center" gap="$1">
                <SizableText size="$3" color="$color10">
                  {oaFriends.friendships.length}
                </SizableText>
              </XStack>
            </ListItem>
          )}

          {/* Groups */}
          <ListItem
            py="$2"
            cursor="pointer"
            onPress={() => showToast('Groups coming soon', { type: 'info' })}
            hoverStyle={{ bg: '$backgroundHover' }}
          >
            <XStack flex={1} items="center">
              <YStack
                width={48}
                height={48}
                rounded={100}
                bg="$color3"
                overflow="hidden"
                items="center"
                justify="center"
                shrink={0}
              >
                <Avatar size={48} image={null} name="Groups" />
              </YStack>
              <YStack ml="$3" flex={1}>
                <SizableText size="$4" color="$color12">
                  群組
                </SizableText>
                <SizableText size="$3" color="$color10" numberOfLines={1}>
                  Project Team, Family Chat...
                </SizableText>
              </YStack>
            </XStack>
            <XStack items="center" gap="$1">
              <SizableText size="$3" color="$color10">
                {groupCount}
              </SizableText>
            </XStack>
          </ListItem>
        </YStack>

        {/* Services */}
        <YStack px="$4" py="$2">
          <SizableText size="$4" fontWeight="700" color="$color12" mb="$4">
            服務
          </SizableText>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <XStack gap="$5" pr="$4">
              {services.map((service) => (
                <YStack
                  key={service.label}
                  items="center"
                  width={64}
                  shrink={0}
                  cursor="pointer"
                  onPress={() => handleServicePress(service.label)}
                >
                  <service.icon size={32} />
                  <SizableText size="$1" color="$color12" mt="$1" text="center">
                    {service.label}
                  </SizableText>
                </YStack>
              ))}
            </XStack>
          </ScrollView>
        </YStack>

        {/* Promotional Banner */}
        <YStack px="$4" py="$4">
          <YStack rounded="$6" overflow="hidden" bg="$blue10">
            <YStack height={192} bg="$blue9" position="relative">
              <YStack
                position="absolute"
                t="$4"
                l="$4"
                style={{ zIndex: 10 }}
                width="66%"
              >
                <SizableText size="$7" fontWeight="700" color="white" lineHeight="$8">
                  DISCOVER{'\n'}NEW COMICS
                </SizableText>
                <SizableText
                  size="$1"
                  color="white"
                  opacity={0.8}
                  mt="$1"
                  lineHeight="$4"
                >
                  Discover the with men:tinncors and new comics.
                </SizableText>
              </YStack>
            </YStack>
            <XStack height={96}>
              <YStack flex={1} bg="$blue10" p="$4" justify="center">
                <SizableText size="$4" fontWeight="700" color="white" lineHeight="$6">
                  FEATURED{'\n'}SERIES
                </SizableText>
              </YStack>
              <YStack flex={1} bg="$yellow9" position="relative">
                <XStack position="absolute" b="$2" r="$2" gap="$2">
                  <YStack width={64} height={80} rounded="$2" bg="$blue8" />
                  <YStack width={64} height={80} rounded="$2" bg="$blue7" />
                </XStack>
              </YStack>
            </XStack>
          </YStack>
        </YStack>

        {/* Recommended Official Accounts */}
        <YStack px="$4" py="$4">
          <SizableText size="$5" fontWeight="700" color="$color12" mb="$3">
            推薦官方帳號
          </SizableText>
          {recommendedOAs?.accounts && recommendedOAs.accounts.length > 0 ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <XStack gap="$4" pr="$4">
                {recommendedOAs.accounts.map((oa) => (
                  <YStack
                    key={oa.id}
                    width={80}
                    items="center"
                    shrink={0}
                    cursor="pointer"
                    onPress={() =>
                      openDetail({
                        id: oa.id,
                        name: oa.name,
                        oaId: oa.uniqueId,
                        imageUrl: oa.imageUrl || undefined,
                      })
                    }
                  >
                    <Avatar size={64} image={oa.imageUrl || null} name={oa.name} />
                    <SizableText
                      size="$2"
                      color="$color12"
                      mt="$2"
                      text="center"
                      numberOfLines={2}
                    >
                      {oa.name}
                    </SizableText>
                  </YStack>
                ))}
              </XStack>
            </ScrollView>
          ) : (
            <SizableText size="$3" color="$color10">
              尚無推薦官方帳號
            </SizableText>
          )}
        </YStack>
      </ScrollView>

      {ScannerSheetComponent}
      {DetailSheetComponent}
    </YStack>
  )
})

type TopBarButtonProps = {
  icon: React.FC<IconProps>
  label: string
  onPress?: () => void
}

const TopBarButton = memo(({ icon: Icon, label, onPress }: TopBarButtonProps) => {
  return (
    <YStack
      onPress={onPress ?? (() => showToast(`${label} coming soon`, { type: 'info' }))}
      cursor="pointer"
    >
      <Icon size={24} />
    </YStack>
  )
})

export default MainPage
