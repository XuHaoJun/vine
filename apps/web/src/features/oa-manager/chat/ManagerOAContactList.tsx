import { useRouter } from 'one'
import { ScrollView, SizableText, XStack, YStack } from 'tamagui'
import { Avatar } from '~/interface/avatars/Avatar'
import { Pressable } from '~/interface/buttons/Pressable'
import { Input } from '~/interface/forms/Input'
import type { ManagerOAContactListItem } from './useManagerOAContacts'

type Props = {
  oaId: string
  selectedUserId?: string
  searchQuery: string
  onSearchQueryChange: (value: string) => void
  contacts: ManagerOAContactListItem[]
  isLoading: boolean
  onSelectContact: (contact: ManagerOAContactListItem) => void
}

function formatContactTime(ts: number | null): string {
  if (ts == null) return 'No chat yet'
  return new Date(ts).toLocaleDateString([], { month: 'short', day: 'numeric' })
}

function formatStatus(contact: ManagerOAContactListItem): string {
  if (contact.chatStatus === 'unread') return 'Unread'
  if (contact.chatStatus === 'no_chat') return 'No chat'
  return contact.friendshipStatus === 'friend' ? 'Friend' : contact.friendshipStatus
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

export function ManagerOAContactList({
  oaId,
  selectedUserId,
  searchQuery,
  onSearchQueryChange,
  contacts,
  isLoading,
  onSelectContact,
}: Props) {
  const router = useRouter()

  return (
    <YStack width={300} shrink={0} borderRightWidth={1} borderColor="$borderColor">
      <YStack p="$3" gap="$2" borderBottomWidth={1} borderColor="$borderColor">
        <SizableText size="$3" fontWeight="700">
          Contact list
        </SizableText>
        <Input
          value={searchQuery}
          onChangeText={onSearchQueryChange}
          placeholder="Search contacts"
          size="$3"
        />
      </YStack>
      <ScrollView>
        {isLoading ? (
          <YStack p="$4">
            <SizableText size="$2" color="$color10">
              Loading contacts...
            </SizableText>
          </YStack>
        ) : contacts.length === 0 ? (
          <YStack p="$4">
            <SizableText size="$2" color="$color10">
              No contacts
            </SizableText>
          </YStack>
        ) : (
          contacts.map((contact) => (
            <Pressable
              key={contact.id}
              role="button"
              aria-label={`Open contact ${contact.userName}`}
              onPress={() => {
                onSelectContact(contact)
                if (contact.chatId) {
                  router.push(`/manager/${oaId}/chat/${contact.chatId}` as any)
                }
              }}
              px="$3"
              py="$3"
              cursor="pointer"
              bg={selectedUserId === contact.userId ? '$color3' : 'transparent'}
              hoverStyle={{
                bg: selectedUserId === contact.userId ? '$color3' : '$color2',
              }}
            >
              <XStack gap="$3" items="center">
                <Avatar size={40} image={contact.userImage} name={contact.userName} />
                <YStack flex={1} minW={0} gap="$1">
                  <XStack items="center" justify="space-between" gap="$2">
                    <SizableText size="$3" fontWeight="600" numberOfLines={1}>
                      {contact.userName}
                    </SizableText>
                    {contact.hasUnread ? (
                      <YStack
                        data-testid="contact-unread-dot"
                        width={8}
                        height={8}
                        rounded="$10"
                        bg="$green9"
                      />
                    ) : null}
                  </XStack>
                  <SizableText size="$2" color="$color10" numberOfLines={1}>
                    {formatStatus(contact)} ·{' '}
                    {formatContactTime(contact.lastInteractionAt)}
                  </SizableText>
                  <SizableText size="$1" color="$color10" numberOfLines={1}>
                    ID {contact.contactId}
                  </SizableText>
                  <ContactTagChips tags={contact.tags} />
                </YStack>
              </XStack>
            </Pressable>
          ))
        )}
      </ScrollView>
    </YStack>
  )
}
