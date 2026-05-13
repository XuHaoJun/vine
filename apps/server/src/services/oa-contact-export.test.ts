import { describe, expect, it } from 'vitest'
import {
  buildOAContactExportCsv,
  OA_CONTACT_EXPORT_COLUMNS,
  type OAContactExportRow,
} from './oa-contact-export'

const exportedAt = new Date('2026-05-13T08:09:10.000Z')

function makeRow(overrides: Partial<OAContactExportRow> = {}): OAContactExportRow {
  return {
    providerScopedUserId: 'user-1',
    displayName: 'Test One',
    friendshipStatus: 'friend',
    lastInteractionAt: '2026-05-12T01:02:03.000Z',
    chatStatus: 'active',
    tagIds: ['tag-2', 'tag-1'],
    tagNames: ['Repeat buyer', 'VIP'],
    managerNoteText: 'Follow up, "quoted"\nnext line',
    exportedAt: exportedAt.toISOString(),
    ...overrides,
  }
}

describe('OA contact CRM CSV export', () => {
  it('uses the approved Phase 2D columns', () => {
    expect(OA_CONTACT_EXPORT_COLUMNS).toEqual([
      'provider_scoped_user_id',
      'display_name',
      'friendship_status',
      'last_interaction_at',
      'chat_status',
      'tag_ids',
      'tag_names',
      'manager_note_text',
      'exported_at',
    ])
  })

  it('escapes notes and flattens tag IDs and names into semicolon-separated cells', () => {
    const csv = buildOAContactExportCsv([makeRow()])

    expect(csv).toContain(
      [
        'provider_scoped_user_id',
        'display_name',
        'friendship_status',
        'last_interaction_at',
        'chat_status',
        'tag_ids',
        'tag_names',
        'manager_note_text',
        'exported_at',
      ].join(','),
    )
    expect(csv).toContain(
      'user-1,Test One,friend,2026-05-12T01:02:03.000Z,active,tag-2;tag-1,Repeat buyer;VIP,"Follow up, ""quoted""\nnext line",2026-05-13T08:09:10.000Z',
    )
  })

  it('keeps empty optional values as empty CSV cells', () => {
    const csv = buildOAContactExportCsv([
      makeRow({
        displayName: '',
        lastInteractionAt: '',
        chatStatus: 'no_chat',
        tagIds: [],
        tagNames: [],
        managerNoteText: '',
      }),
    ])

    expect(csv).toContain('user-1,,friend,,no_chat,,,,2026-05-13T08:09:10.000Z')
  })

  it('does not include chat message bodies', () => {
    const csv = buildOAContactExportCsv([
      makeRow({ managerNoteText: 'Manager-only CRM note' }),
    ])

    expect(csv).toContain('Manager-only CRM note')
    expect(csv).not.toContain('message_body')
    expect(csv).not.toContain('hello from chat')
  })
})
