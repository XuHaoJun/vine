import { describe, expect, it } from 'vitest'
import { resolveManagerOAProfileContact } from '../../../../features/oa-manager/chat/managerOAChatSelection'
import type { ManagerOAContactListItem } from '../../../../features/oa-manager/chat/useManagerOAContacts'

function makeContact(
  overrides: Partial<ManagerOAContactListItem>,
): ManagerOAContactListItem {
  return {
    id: 'friendship-1',
    userId: 'user-1',
    contactId: 'user-1',
    userName: 'Ada',
    userImage: null,
    friendshipStatus: 'friend',
    lastInteractionAt: null,
    chatId: null,
    hasUnread: false,
    chatStatus: 'no_chat',
    profileId: null,
    noteText: '',
    noteUpdatedAt: null,
    tags: [],
    ...overrides,
  }
}

describe('resolveManagerOAProfileContact', () => {
  it('uses the live contacts row for a selected no-chat contact', () => {
    const selectedContact = makeContact({ noteText: 'old note', tags: [] })
    const liveContact = makeContact({
      noteText: 'updated note',
      tags: [
        {
          id: 'tag-1',
          assignmentId: 'assignment-1',
          name: 'VIP',
          color: null,
        },
      ],
    })

    expect(
      resolveManagerOAProfileContact({
        contacts: [liveContact],
        selectedChatUserId: undefined,
        selectedContact,
      }),
    ).toBe(liveContact)
  })
})
