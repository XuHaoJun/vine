import { router } from 'one'
import { memo, useState } from 'react'
import { ScrollView, Sheet, Text, XStack, YStack } from 'tamagui'

import { Avatar } from '~/interface/avatars/Avatar'
import { Button } from '~/interface/buttons/Button'
import { Image } from '~/interface/image/Image'
import { ChatCircleIcon } from '~/interface/icons/phosphor/ChatCircleIcon'
import { showToast } from '~/interface/toast/Toast'
import { useTanMutation, useTanQuery, useTanQueryClient } from '~/query'
import { oaClient } from '~/features/oa/client'
import { useAuth } from '~/features/auth/client/authClient'
import { useChats } from '~/features/chat/useChats'
import { zero } from '~/zero/client'

// TODO: Once DB has these fields, remove mocks
const MOCK_COVER_URL =
  'https://images.unsplash.com/photo-1557683316-973673baf926?w=800&q=80'
const MOCK_FRIEND_COUNT = 12847
const MOCK_POST_COUNT = 42
const MOCK_LOCATION = '台灣'
const MOCK_DESCRIPTION =
  'Vine 是新一代的即時通訊平台，提供安全、快速、有趣的聊天體驗。加入我們，探索無限可能！'

export type OADetailData = {
  id: string
  name: string
  oaId: string
  imageUrl?: string
}

type OADetailSheetProps = OADetailData & {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function OADetailSheet({
  id,
  name,
  oaId,
  imageUrl,
  open,
  onOpenChange,
}: OADetailSheetProps) {
  const queryClient = useTanQueryClient()
  const { user } = useAuth()
  const userId = user?.id ?? ''
  const { chats } = useChats()

  const { data: isFriendData } = useTanQuery({
    queryKey: ['oa', 'isFriend', oaId],
    queryFn: () => oaClient.isOAFriend({ officialAccountId: id }),
    enabled: open,
  })

  const addFriend = useTanMutation({
    mutationFn: () => oaClient.addOAFriend({ officialAccountId: id }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['oa', 'isFriend', oaId] })
      queryClient.invalidateQueries({ queryKey: ['oa', 'myFriends'] })
      showToast('已加入好友', { type: 'success' })
    },
    onError: () => {
      showToast('加入好友失敗', { type: 'error' })
    },
  })

  const removeFriend = useTanMutation({
    mutationFn: () => oaClient.removeOAFriend({ officialAccountId: id }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['oa', 'isFriend', oaId] })
      queryClient.invalidateQueries({ queryKey: ['oa', 'myFriends'] })
      showToast('已移除好友', { type: 'success' })
    },
    onError: () => {
      showToast('移除好友失敗', { type: 'error' })
    },
  })

  const isFriend = isFriendData?.isFriend ?? false

  const handleStartChat = () => {
    if (!userId || !id) return

    const existingChat = chats.find(
      (c) => c.type === 'oa' && c.members?.some((m) => m.oaId === id),
    )

    if (existingChat?.id) {
      onOpenChange(false)
      router.push(`/home/talks/${existingChat.id}`)
      return
    }

    const chatId = crypto.randomUUID()
    const now = Date.now()
    zero.mutate.chat.insertOAChat({
      chatId,
      userId,
      oaId: id,
      member1Id: crypto.randomUUID(),
      member2Id: crypto.randomUUID(),
      createdAt: now,
    })
    onOpenChange(false)
    router.push(`/home/talks/${chatId}`)
  }

  const handleToggleFriend = () => {
    if (isFriend) {
      removeFriend.mutate()
    } else {
      addFriend.mutate()
    }
  }

  const handleAddFriend = () => {
    if (isFriend) {
      handleStartChat()
    } else {
      addFriend.mutate()
    }
  }

  return (
    <Sheet modal open={open} onOpenChange={onOpenChange} snapPoints={[100]}>
      <Sheet.Overlay
        opacity={0.5}
        enterStyle={{ opacity: 0 }}
        exitStyle={{ opacity: 0 }}
      />
      <Sheet.Frame flex={1} bg="$background">
        {/* Fixed bottom Add Friend Button */}
        <YStack
          position="absolute"
          b={0}
          l={0}
          r={0}
          z={10}
          p="$4"
          bg="$background"
          borderTopWidth={1}
          borderColor="$borderColor"
        >
          <Button
            size="$5"
            onPress={isFriend ? handleStartChat : handleToggleFriend}
            disabled={addFriend.isPending || removeFriend.isPending}
          >
            {isFriend ? '開始聊天' : '加入好友'}
          </Button>
        </YStack>

        <ScrollView flex={1} pb="$20">
          {/* Top-right buttons */}
          <XStack position="absolute" t="$3" r="$3" z={10} gap="$2">
            {/* Menu button */}
            <YStack
              width={36}
              height={36}
              rounded={9999}
              bg="$color4"
              items="center"
              justify="center"
              cursor="pointer"
              onPress={() => showToast('功能選單即將上線', { type: 'info' })}
              hoverStyle={{ bg: '$color5' }}
            >
              <XStack gap="$0.5">
                <YStack width={4} height={4} rounded={9999} bg="$color11" />
                <YStack width={4} height={4} rounded={9999} bg="$color11" />
                <YStack width={4} height={4} rounded={9999} bg="$color11" />
              </XStack>
            </YStack>

            {/* Close button */}
            <YStack
              width={36}
              height={36}
              rounded={9999}
              bg="$color4"
              items="center"
              justify="center"
              cursor="pointer"
              onPress={() => onOpenChange(false)}
              hoverStyle={{ bg: '$color5' }}
            >
              <Text fontSize={20} color="$color11" fontWeight="300" mt={-2}>
                ×
              </Text>
            </YStack>
          </XStack>

          {/* Cover Image */}
          <YStack height={180} bg="$color5" position="relative">
            <Image
              src={MOCK_COVER_URL}
              alt="Cover"
              width="100%"
              height={180}
              objectFit="cover"
            />
          </YStack>

          {/* Main Content - positioned to overlap cover */}
          <YStack px="$4" mt={-40} position="relative" z={5}>
            {/* Logo + Verified Badge Row */}
            <XStack items="flex-end" gap="$3" mb="$2">
              <YStack
                rounded={9999}
                borderWidth={4}
                borderColor="$background"
                overflow="hidden"
              >
                <Avatar size={72} image={imageUrl || null} name={name} />
              </YStack>
            </XStack>

            {/* Brand Name + Verified Badge */}
            <XStack items="center" gap="$2" mb="$1" flexWrap="wrap">
              <Text fontSize={20} fontWeight="700" color="$color12">
                {name}
              </Text>
              <XStack
                bg="$blue10"
                px="$2"
                py="$0.5"
                rounded={9999}
                items="center"
                gap="$1"
              >
                <Text fontSize={10} fontWeight="700" color="$white">
                  ✓
                </Text>
                <Text fontSize={10} fontWeight="700" color="$white">
                  官方帳號
                </Text>
              </XStack>
            </XStack>

            {/* Friend Count */}
            <Text fontSize={12} color="$color10" mt="$1" mb="$3">
              好友人數{' '}
              {MOCK_FRIEND_COUNT.toLocaleString('en-US', {
                maximumFractionDigits: 0,
              })}
            </Text>

            {/* Description */}
            <YStack
              p="$3"
              bg="$color2"
              rounded="$4"
              borderWidth={1}
              borderColor="$borderColor"
              mb="$4"
            >
              <Text fontSize={14} color="$color11" lineHeight={20}>
                {MOCK_DESCRIPTION}
              </Text>
            </YStack>

            {/* Action Buttons Row */}
            <XStack gap="$3" mb="$5">
              {/* Add Friend / Start Chat Button */}
              <YStack
                flex={1}
                p="$3"
                bg={isFriend ? '$green3' : '$color2'}
                rounded="$4"
                borderWidth={1}
                borderColor={isFriend ? '$green6' : '$borderColor'}
                items="center"
                gap="$1"
                cursor="pointer"
                onPress={handleAddFriend}
                hoverStyle={{ bg: isFriend ? '$green4' : '$color3' }}
              >
                <YStack
                  width={24}
                  height={24}
                  rounded={9999}
                  bg="$green9"
                  items="center"
                  justify="center"
                >
                  {isFriend ? (
                    <ChatCircleIcon size={14} color="white" />
                  ) : (
                    <Text fontSize={14} color="$white" fontWeight="700">
                      +
                    </Text>
                  )}
                </YStack>
                <Text fontSize={12} fontWeight="600" color="$color12">
                  {isFriend ? '開始聊天' : '加入好友'}
                </Text>
              </YStack>

              {/* Posts Button */}
              <YStack
                flex={1}
                p="$3"
                bg="$color2"
                rounded="$4"
                borderWidth={1}
                borderColor="$borderColor"
                items="center"
                gap="$1"
                cursor="pointer"
                onPress={() => showToast('貼文功能即將上線', { type: 'info' })}
                hoverStyle={{ bg: '$color3' }}
              >
                <XStack
                  flexWrap="wrap"
                  gap={3}
                  width={24}
                  height={24}
                  items="center"
                  justify="center"
                >
                  {[1, 2, 3, 4, 5, 6].map((i) => (
                    <YStack key={i} width={10} height={10} rounded={3} bg="$color10" />
                  ))}
                </XStack>
                <Text fontSize={12} fontWeight="600" color="$color12">
                  {MOCK_POST_COUNT} 貼文
                </Text>
              </YStack>

              {/* Call Button */}
              <YStack
                flex={1}
                p="$3"
                bg="$color2"
                rounded="$4"
                borderWidth={1}
                borderColor="$borderColor"
                items="center"
                gap="$1"
                cursor="pointer"
                onPress={() => showToast('通話功能即將上線', { type: 'info' })}
                hoverStyle={{ bg: '$color3' }}
              >
                <YStack
                  width={24}
                  height={24}
                  rounded={9999}
                  bg="$color10"
                  items="center"
                  justify="center"
                >
                  <Text fontSize={10} color="$white" fontWeight="700">
                    📞
                  </Text>
                </YStack>
                <Text fontSize={12} fontWeight="600" color="$color12">
                  通話
                </Text>
              </YStack>
            </XStack>

            {/* Social Platforms Section */}
            <YStack gap="$2" mb="$4">
              <Text
                fontSize={12}
                fontWeight="600"
                color="$color10"
                textTransform="uppercase"
              >
                社群平台
              </Text>
              <YStack
                p="$3"
                bg="$color2"
                rounded="$4"
                borderWidth={1}
                borderColor="$borderColor"
              >
                <Text fontSize={13} color="$color10" mb="$2">
                  您也可透過其他社群平台確認資訊。
                </Text>
                <XStack gap="$3">
                  {/* Facebook */}
                  <YStack
                    width={32}
                    height={32}
                    rounded="$2"
                    bg="$color5"
                    items="center"
                    justify="center"
                  >
                    <Text fontSize={14} fontWeight="700" color="$color11">
                      f
                    </Text>
                  </YStack>
                  {/* Instagram */}
                  <YStack
                    width={32}
                    height={32}
                    rounded="$2"
                    bg="$color5"
                    items="center"
                    justify="center"
                  >
                    <Text fontSize={14} fontWeight="700" color="$color11">
                      ig
                    </Text>
                  </YStack>
                </XStack>
              </YStack>
            </YStack>

            {/* Account ID */}
            <YStack items="center" py="$4">
              <Text fontSize={14} color="$color10">
                @{oaId}
              </Text>
            </YStack>

            {/* Location */}
            <YStack items="flex-end" pb="$4">
              <Text fontSize={12} color="$color10">
                所在國家或地區：{MOCK_LOCATION}
              </Text>
            </YStack>
          </YStack>
        </ScrollView>
      </Sheet.Frame>
    </Sheet>
  )
}

// Hook to control the sheet from parent
export function useOADetailSheet() {
  const [selectedOA, setSelectedOA] = useState<OADetailData | null>(null)

  const openDetail = (oa: OADetailData) => {
    setSelectedOA(oa)
  }

  const DetailSheetComponent = selectedOA ? (
    <OADetailSheet
      id={selectedOA.id}
      name={selectedOA.name}
      oaId={selectedOA.oaId}
      imageUrl={selectedOA.imageUrl}
      open={true}
      onOpenChange={(open) => {
        if (!open) setSelectedOA(null)
      }}
    />
  ) : null

  return { openDetail, DetailSheetComponent }
}
