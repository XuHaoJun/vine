import { router } from 'one'
import { memo, useState } from 'react'
import { SizableText, XStack, YStack } from 'tamagui'

import { Button } from '~/interface/buttons/Button'
import { ClockIcon } from '~/interface/icons/phosphor/ClockIcon'
import { FunnelIcon } from '~/interface/icons/phosphor/FunnelIcon'
import { GearIcon } from '~/interface/icons/phosphor/GearIcon'
import { SearchInput } from '~/interface/forms/SearchInput'
import { CreateGroupDialog } from '~/interface/dialogs/CreateGroupDialog'

type TalksHeaderProps = {
  activeTab: 'chats' | 'friends'
  onTabChange: (tab: 'chats' | 'friends') => void
  searchQuery: string
  onSearchChange: (query: string) => void
  pendingCount: number
}

export const TalksHeader = memo(
  ({
    activeTab,
    onTabChange,
    searchQuery,
    onSearchChange,
    pendingCount,
  }: TalksHeaderProps) => {
    const [showCreateGroup, setShowCreateGroup] = useState(false)

    return (
      <YStack bg="$background" pb="$2">
        <XStack px="$3" py="$2" justify="space-between" items="center">
          <XStack gap="$4">
            <SizableText
              size="$4"
              fontWeight={activeTab === 'chats' ? '700' : '400'}
              color={activeTab === 'chats' ? '$color12' : '$color10'}
              cursor="pointer"
              onPress={() => onTabChange('chats')}
            >
              聊天 ▾
            </SizableText>
            <XStack items="center" gap="$1">
              <SizableText
                size="$4"
                fontWeight={activeTab === 'friends' ? '700' : '400'}
                color={activeTab === 'friends' ? '$color12' : '$color10'}
                cursor="pointer"
                onPress={() => onTabChange('friends')}
              >
                好友
              </SizableText>
              {pendingCount > 0 && activeTab === 'friends' && (
                <XStack
                  bg="$red9"
                  rounded="$10"
                  minW={16}
                  height={16}
                  items="center"
                  justify="center"
                  px="$1"
                >
                  <SizableText size="$1" color="white" fontWeight="bold">
                    {pendingCount}
                  </SizableText>
                </XStack>
              )}
            </XStack>
          </XStack>

          <XStack gap="$3" items="center">
            <Button variant="transparent" cursor="pointer" p="$1">
              <ClockIcon size={20} />
            </Button>
            <Button
              variant="transparent"
              cursor="pointer"
              p="$1"
              onPress={() => setShowCreateGroup(true)}
            >
              <SizableText size="$4">＋</SizableText>
            </Button>
            <Button
              variant="transparent"
              cursor="pointer"
              p="$1"
              onPress={() => router.push('/home/main')}
            >
              <GearIcon size={20} />
            </Button>
          </XStack>
        </XStack>

        <XStack px="$3" gap="$2">
          <XStack flex={1} bg="$color3" rounded="$2" items="center" px="$2" py="$1.5">
            <SearchInput
              flex={1}
              placeholder={activeTab === 'chats' ? '搜尋聊天' : '搜尋好友'}
              value={searchQuery}
              onChangeText={onSearchChange}
              placeholderTextColor="$color10"
            />
            <FunnelIcon size={18} color="$color10" />
          </XStack>
        </XStack>
        <CreateGroupDialog
          open={showCreateGroup}
          onOpenChange={setShowCreateGroup}
          onSuccess={(chatId) => router.push(`/home/talks/${chatId}` as any)}
        />
      </YStack>
    )
  },
)
