import { memo, useState } from 'react'
import { ScrollView, SizableText, XStack, YStack } from 'tamagui'

import { useFriends } from '~/features/chat/useFriendship'
import { useAuth } from '~/features/auth/client/authClient'
import { Avatar } from '~/interface/avatars/Avatar'
import { SearchInput } from '~/interface/forms/SearchInput'

type FriendPickerProps = {
  selectedUserIds: string[]
  onSelectionChange: (userIds: string[]) => void
  excludeUserIds?: string[]
  maxSelection?: number
}

export const FriendPicker = memo(
  ({
    selectedUserIds,
    onSelectionChange,
    excludeUserIds = [],
    maxSelection,
  }: FriendPickerProps) => {
    const { friends } = useFriends()
    const { user } = useAuth()
    const currentUserId = user?.id ?? ''
    const [searchQuery, setSearchQuery] = useState('')

    const filteredFriends =
      friends
        ?.filter((f) => {
          const otherUser = f.requesterId === currentUserId ? f.addressee : f.requester
          if (!otherUser?.name) return false
          if (excludeUserIds.includes(otherUser.id)) return false
          if (searchQuery) {
            return otherUser.name.toLowerCase().includes(searchQuery.toLowerCase())
          }
          return true
        })
        .map((f) => ({
          id: f.requesterId === currentUserId ? f.addresseeId : f.requesterId,
          name: (f.requesterId === currentUserId ? f.addressee : f.requester)?.name ?? '',
          image:
            (f.requesterId === currentUserId ? f.addressee : f.requester)?.image ?? null,
        })) ?? []

    const toggleUser = (userId: string) => {
      if (selectedUserIds.includes(userId)) {
        onSelectionChange(selectedUserIds.filter((id) => id !== userId))
      } else if (!maxSelection || selectedUserIds.length < maxSelection) {
        onSelectionChange([...selectedUserIds, userId])
      }
    }

    return (
      <YStack flex={1}>
        <XStack px="$3" py="$2">
          <SearchInput
            flex={1}
            placeholder="搜尋好友"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </XStack>

        <ScrollView flex={1}>
          {filteredFriends.map((friend) => {
            const isSelected = selectedUserIds.includes(friend.id)
            return (
              <XStack
                key={friend.id}
                px="$3"
                py="$2"
                items="center"
                gap="$3"
                cursor="pointer"
                onPress={() => toggleUser(friend.id)}
                bg={isSelected ? '$color3' : 'transparent'}
              >
                <Avatar size={40} image={friend.image} name={friend.name} />
                <SizableText flex={1}>{friend.name}</SizableText>
                {isSelected && <SizableText color="$blue10">✓</SizableText>}
              </XStack>
            )
          })}
        </ScrollView>
      </YStack>
    )
  },
)
