import { useRouter } from 'one'
import { ScrollView, SizableText, XStack, YStack } from 'tamagui'
import { Avatar } from '~/interface/avatars/Avatar'
import { Pressable } from '~/interface/buttons/Pressable'
import { Input } from '~/interface/forms/Input'
import type { ManagerOAChatListItem } from './useManagerOAChats'
import type { ManagerOAContactListItem } from './useManagerOAContacts'

type Props = {
  oaId: string
  selectedChatId?: string
  searchQuery: string
  onSearchQueryChange: (value: string) => void
  chats: ManagerOAChatListItem[]
  contacts: ManagerOAContactListItem[]
  isLoading: boolean
}

function formatChatTime(ts: number | null): string {
  if (!ts) return ''
  const date = new Date(ts)
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

function ContactTagChips({ tags }: { tags: ManagerOAContactListItem['tags'] }) {
  if (tags.length === 0) return null

  return (
    <XStack gap="$1" flexWrap="wrap" mt="$1">
      {tags.slice(0, 3).map((tag) => (
        <YStack key={tag.id} px="$2" py="$1" rounded="$2" bg="$color3">
          <SizableText size="$1" numberOfLines={1}>
            {tag.name}
          </SizableText>
        </YStack>
      ))}
    </XStack>
  )
}

export function ManagerOAChatList({
  oaId,
  selectedChatId,
  searchQuery,
  onSearchQueryChange,
  chats,
  contacts,
  isLoading,
}: Props) {
  const router = useRouter()
  const contactsByUserId = new Map(contacts.map((contact) => [contact.userId, contact]))

  return (
    <YStack width={280} shrink={0} borderRightWidth={1} borderColor="$borderColor">
      <YStack p="$3" borderBottomWidth={1} borderColor="$borderColor">
        <Input
          value={searchQuery}
          onChangeText={onSearchQueryChange}
          placeholder="Search chats"
          size="$3"
        />
      </YStack>
      <ScrollView>
        {isLoading ? (
          <YStack p="$4">
            <SizableText size="$2" color="$color10">
              Loading chats...
            </SizableText>
          </YStack>
        ) : chats.length === 0 ? (
          <YStack p="$4">
            <SizableText size="$2" color="$color10">
              No chats
            </SizableText>
          </YStack>
        ) : (
          chats.map((chat) => {
            const tags = contactsByUserId.get(chat.userId)?.tags ?? []
            return (
            <Pressable
              key={chat.id}
              role="button"
              aria-label={`Open chat with ${chat.userName}`}
              onPress={() => router.push(`/manager/${oaId}/chat/${chat.id}` as any)}
              px="$3"
              py="$3"
              cursor="pointer"
              bg={selectedChatId === chat.id ? '$color3' : 'transparent'}
              hoverStyle={{ bg: selectedChatId === chat.id ? '$color3' : '$color2' }}
            >
              <XStack gap="$3" items="center">
                <Avatar size={40} image={chat.userImage} name={chat.userName} />
                <YStack flex={1} minW={0} gap="$1">
                  <XStack items="center" justify="space-between" gap="$2">
                    <SizableText size="$3" fontWeight="600" numberOfLines={1}>
                      {chat.userName}
                    </SizableText>
                    <SizableText size="$1" color="$color10">
                      {formatChatTime(chat.lastMessageAt)}
                    </SizableText>
                  </XStack>
                  <XStack items="center" gap="$2">
                    {chat.hasUnread && (
                      <YStack
                        data-testid="unread-dot"
                        width={8}
                        height={8}
                        rounded="$10"
                        bg="$green9"
                      />
                    )}
                    <SizableText size="$2" color="$color10" numberOfLines={1}>
                      {chat.lastMessageText ?? ''}
                    </SizableText>
                  </XStack>
                  <ContactTagChips tags={tags} />
                </YStack>
              </XStack>
            </Pressable>
            )
          })
        )}
      </ScrollView>
    </YStack>
  )
}
