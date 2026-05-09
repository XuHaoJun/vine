import { SizableText, YStack } from 'tamagui'
import { Avatar } from '~/interface/avatars/Avatar'
import type { ManagerOAContactListItem } from './useManagerOAContacts'

type Props = {
  name: string
  image: string | null
  contact?: ManagerOAContactListItem | null
}

function formatLastInteraction(
  contact: ManagerOAContactListItem | null | undefined,
): string {
  if (!contact) return 'Unknown'
  const ts = contact.lastInteractionAt
  if (!ts) return 'No chat yet'
  return new Date(ts).toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatChatStatus(contact: ManagerOAContactListItem | null | undefined): string {
  if (!contact) return 'Unknown'
  if (contact.chatStatus === 'unread') return 'Unread'
  if (contact.chatStatus === 'no_chat') return 'No chat'
  return 'Active'
}

function ProfileField({ label, value }: { label: string; value: string }) {
  return (
    <YStack gap="$1">
      <SizableText size="$1" color="$color10">
        {label}
      </SizableText>
      <SizableText size="$2" numberOfLines={2}>
        {value}
      </SizableText>
    </YStack>
  )
}

export function ManagerOAProfilePanel({ name, image, contact }: Props) {
  return (
    <YStack
      width={260}
      shrink={0}
      p="$5"
      gap="$4"
      borderLeftWidth={1}
      borderColor="$borderColor"
    >
      <YStack items="center" gap="$3">
        <Avatar size={88} image={image} name={name} />
        <SizableText size="$5" fontWeight="700" text="center" numberOfLines={2}>
          {name}
        </SizableText>
      </YStack>

      <YStack gap="$3">
        <ProfileField label="Contact ID" value={contact?.contactId ?? 'Unknown'} />
        <ProfileField
          label="Friendship"
          value={contact?.friendshipStatus === 'friend' ? 'Friend' : 'Unknown'}
        />
        <ProfileField
          label="Last interaction"
          value={formatLastInteraction(contact)}
        />
        <ProfileField label="Chat status" value={formatChatStatus(contact)} />
      </YStack>
    </YStack>
  )
}
