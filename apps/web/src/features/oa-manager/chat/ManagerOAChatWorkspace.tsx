import { useMemo, useState } from 'react'
import { XStack } from 'tamagui'
import { ManagerOAChatList } from './ManagerOAChatList'
import { ManagerOAChatModeNav, type ManagerOAChatMode } from './ManagerOAChatModeNav'
import { ManagerOAChatRoom } from './ManagerOAChatRoom'
import { ManagerOAContactList } from './ManagerOAContactList'
import { ManagerOAProfilePanel } from './ManagerOAProfilePanel'
import { useManagerOAChats } from './useManagerOAChats'
import {
  useManagerOAContacts,
  type ManagerOAContactListItem,
} from './useManagerOAContacts'

type Props = {
  oaId: string
  chatId?: string
}

export function ManagerOAChatWorkspace({ oaId, chatId }: Props) {
  const [mode, setMode] = useState<ManagerOAChatMode>('chats')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedContact, setSelectedContact] =
    useState<ManagerOAContactListItem | null>(null)
  const { chats, isLoading } = useManagerOAChats(oaId, searchQuery)
  const { contacts, isLoading: contactsLoading } = useManagerOAContacts(
    oaId,
    searchQuery,
    chats,
  )
  const selected = useMemo(
    () => chats.find((chat) => chat.id === chatId) ?? null,
    [chatId, chats],
  )
  const selectedContactFromChat = useMemo(
    () => contacts.find((contact) => contact.userId === selected?.userId) ?? null,
    [contacts, selected?.userId],
  )
  const profileContact = selectedContactFromChat ?? selectedContact

  return (
    <XStack flex={1} minH={0} bg="$background" $platform-web={{ overflow: 'hidden' }}>
      <ManagerOAChatModeNav
        mode={mode}
        onModeChange={(nextMode) => {
          setMode(nextMode)
          setSearchQuery('')
        }}
      />
      {mode === 'contacts' ? (
        <ManagerOAContactList
          oaId={oaId}
          selectedUserId={profileContact?.userId}
          searchQuery={searchQuery}
          onSearchQueryChange={setSearchQuery}
          contacts={contacts}
          isLoading={contactsLoading}
          onSelectContact={setSelectedContact}
        />
      ) : (
        <ManagerOAChatList
          oaId={oaId}
          selectedChatId={chatId}
          searchQuery={searchQuery}
          onSearchQueryChange={setSearchQuery}
          chats={chats}
          isLoading={isLoading}
        />
      )}
      <ManagerOAChatRoom
        oaId={oaId}
        chatId={chatId}
        emptyStateLabel={
          mode === 'contacts' && profileContact?.chatId === null
            ? 'This contact has no chat yet'
            : undefined
        }
      />
      {selected || profileContact ? (
        <ManagerOAProfilePanel
          name={profileContact?.userName ?? selected?.userName ?? 'Unknown user'}
          image={profileContact?.userImage ?? selected?.userImage ?? null}
        />
      ) : null}
    </XStack>
  )
}
