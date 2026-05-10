import type { ManagerOAContactListItem } from './useManagerOAContacts'

export function resolveManagerOAProfileContact({
  contacts,
  selectedChatUserId,
  selectedContact,
}: {
  contacts: ManagerOAContactListItem[]
  selectedChatUserId: string | undefined
  selectedContact: ManagerOAContactListItem | null
}) {
  const selectedUserId = selectedChatUserId ?? selectedContact?.userId
  if (!selectedUserId) return null

  return (
    contacts.find((contact) => contact.userId === selectedUserId) ??
    (selectedContact?.userId === selectedUserId ? selectedContact : null)
  )
}
