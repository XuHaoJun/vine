import { useMemo, useState } from 'react'
import { XStack } from 'tamagui'

import { useManagerOAChats } from './useManagerOAChats'
import { ManagerOAChatList } from './ManagerOAChatList'
import { ManagerOAChatRoom } from './ManagerOAChatRoom'
import { ManagerOAProfilePanel } from './ManagerOAProfilePanel'

type Props = {
  oaId: string
  chatId?: string
}

export function ManagerOAChatWorkspace({ oaId, chatId }: Props) {
  const [searchQuery, setSearchQuery] = useState('')
  const { chats, isLoading } = useManagerOAChats(oaId, searchQuery)
  const selected = useMemo(
    () => chats.find((chat) => chat.id === chatId) ?? null,
    [chatId, chats],
  )

  return (
    <XStack flex={1} minH={0} bg="$background" $platform-web={{ overflow: 'hidden' }}>
      <ManagerOAChatList
        oaId={oaId}
        selectedChatId={chatId}
        searchQuery={searchQuery}
        onSearchQueryChange={setSearchQuery}
        chats={chats}
        isLoading={isLoading}
      />
      <ManagerOAChatRoom oaId={oaId} chatId={chatId} />
      {selected ? (
        <ManagerOAProfilePanel name={selected.userName} image={selected.userImage} />
      ) : null}
    </XStack>
  )
}
