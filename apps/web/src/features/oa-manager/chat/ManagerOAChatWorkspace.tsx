import { useMemo, useState } from 'react'
import { XStack } from 'tamagui'
import { ManagerOAChatList } from './ManagerOAChatList'
import { ManagerOAChatModeNav, type ManagerOAChatMode } from './ManagerOAChatModeNav'
import { ManagerOAChatRoom } from './ManagerOAChatRoom'
import { ManagerOACustomFiltersPage } from './ManagerOACustomFiltersPage'
import { resolveManagerOAProfileContact } from './managerOAChatSelection'
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
  initialMode?: ManagerOAChatMode
}

export function ManagerOAChatWorkspace({ oaId, chatId, initialMode }: Props) {
  const [mode, setMode] = useState<ManagerOAChatMode>(initialMode ?? 'chats')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedContact, setSelectedContact] = useState<ManagerOAContactListItem | null>(
    null,
  )
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
  const profileContact = useMemo(
    () =>
      resolveManagerOAProfileContact({
        contacts,
        selectedChatUserId: selected?.userId,
        selectedContact,
      }),
    [contacts, selected?.userId, selectedContact],
  )
  const effectiveChatId =
    mode === 'contacts' && profileContact && profileContact.chatId === null
      ? undefined
      : chatId

  return (
    <XStack flex={1} minH={0} bg="$background" $platform-web={{ overflow: 'hidden' }}>
      <ManagerOAChatModeNav
        mode={mode}
        onModeChange={(nextMode) => {
          setMode(nextMode)
          setSearchQuery('')
        }}
      />
      {mode === 'custom-filters' ? (
        <ManagerOACustomFiltersPage oaId={oaId} onBackToChat={() => setMode('chats')} />
      ) : (
        <>
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
              contacts={contacts}
              isLoading={isLoading}
            />
          )}
          <ManagerOAChatRoom
            oaId={oaId}
            chatId={effectiveChatId}
            emptyStateLabel={
              mode === 'contacts' && profileContact?.chatId === null
                ? 'This contact has no chat yet'
                : undefined
            }
          />
          {selected || profileContact ? (
            <ManagerOAProfilePanel
              oaId={oaId}
              name={profileContact?.userName ?? selected?.userName ?? 'Unknown user'}
              image={profileContact?.userImage ?? selected?.userImage ?? null}
              contact={profileContact}
            />
          ) : null}
        </>
      )}
    </XStack>
  )
}
