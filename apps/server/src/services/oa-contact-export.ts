import {
  oaContactProfile,
  oaContactTag,
  oaContactTagAssignment,
  oaFriendship,
  oaProvider,
  officialAccount,
} from '@vine/db/schema-oa'
import { chat, chatMember, userPublic } from '@vine/db/schema-public'
import { and, eq, inArray, isNotNull } from 'drizzle-orm'
import { alias } from 'drizzle-orm/pg-core'
import type { schema } from '@vine/db'
import type { NodePgDatabase } from 'drizzle-orm/node-postgres'

export const OA_CONTACT_EXPORT_COLUMNS = [
  'provider_scoped_user_id',
  'display_name',
  'friendship_status',
  'last_interaction_at',
  'chat_status',
  'tag_ids',
  'tag_names',
  'manager_note_text',
  'exported_at',
] as const

export type OAContactExportRow = {
  providerScopedUserId: string
  displayName: string
  friendshipStatus: string
  lastInteractionAt: string
  chatStatus: 'active' | 'no_chat'
  tagIds: string[]
  tagNames: string[]
  managerNoteText: string
  exportedAt: string
}

type OAContactExportDeps = {
  db: NodePgDatabase<typeof schema>
}

type ExportContactsInput = {
  oaId: string
  ownerId: string
  exportedAt: Date
}

type ExportContactsResult = {
  filename: string
  csv: string
}

function csvCell(value: string): string {
  if (!/[",\n\r]/.test(value)) return value
  return `"${value.replaceAll('"', '""')}"`
}

function rowToCsv(row: OAContactExportRow): string {
  return [
    row.providerScopedUserId,
    row.displayName,
    row.friendshipStatus,
    row.lastInteractionAt,
    row.chatStatus,
    row.tagIds.join(';'),
    row.tagNames.join(';'),
    row.managerNoteText,
    row.exportedAt,
  ]
    .map(csvCell)
    .join(',')
}

export function buildOAContactExportCsv(rows: OAContactExportRow[]): string {
  return [OA_CONTACT_EXPORT_COLUMNS.join(','), ...rows.map(rowToCsv)].join('\n')
}

function filenameFor(uniqueId: string, exportedAt: Date): string {
  const safeUniqueId = uniqueId.replace(/[^a-zA-Z0-9_-]/g, '_')
  const date = exportedAt.toISOString().slice(0, 10)
  return `oa-${safeUniqueId}-contacts-${date}.csv`
}

export function createOAContactExportService(deps: OAContactExportDeps) {
  const { db } = deps

  async function exportContactsCsv(
    input: ExportContactsInput,
  ): Promise<ExportContactsResult | null> {
    const [account] = await db
      .select({
        id: officialAccount.id,
        uniqueId: officialAccount.uniqueId,
      })
      .from(officialAccount)
      .innerJoin(oaProvider, eq(officialAccount.providerId, oaProvider.id))
      .where(and(eq(officialAccount.id, input.oaId), eq(oaProvider.ownerId, input.ownerId)))
      .limit(1)

    if (!account) return null

    const contacts = await db
      .select({
        userId: oaFriendship.userId,
        friendshipStatus: oaFriendship.status,
        displayName: userPublic.name,
        noteText: oaContactProfile.noteText,
      })
      .from(oaFriendship)
      .leftJoin(userPublic, eq(oaFriendship.userId, userPublic.id))
      .leftJoin(
        oaContactProfile,
        and(
          eq(oaContactProfile.oaId, oaFriendship.oaId),
          eq(oaContactProfile.userId, oaFriendship.userId),
        ),
      )
      .where(and(eq(oaFriendship.oaId, input.oaId), eq(oaFriendship.status, 'friend')))

    const userIds = contacts.map((contact) => contact.userId)
    const tagsByUserId = new Map<string, Array<{ id: string; name: string }>>()
    const chatByUserId = new Map<string, { lastInteractionAt: string }>()

    if (userIds.length > 0) {
      const tagRows = await db
        .select({
          userId: oaContactTagAssignment.userId,
          tagId: oaContactTag.id,
          tagName: oaContactTag.name,
        })
        .from(oaContactTagAssignment)
        .innerJoin(oaContactTag, eq(oaContactTagAssignment.tagId, oaContactTag.id))
        .where(
          and(
            eq(oaContactTagAssignment.oaId, input.oaId),
            inArray(oaContactTagAssignment.userId, userIds),
          ),
        )

      for (const tag of tagRows) {
        const userTags = tagsByUserId.get(tag.userId) ?? []
        userTags.push({ id: tag.tagId, name: tag.tagName })
        tagsByUserId.set(tag.userId, userTags)
      }

      const userMember = alias(chatMember, 'userMember')
      const oaMember = alias(chatMember, 'oaMember')

      const chatRows = await db
        .select({
          userId: userMember.userId,
          lastMessageAt: chat.lastMessageAt,
        })
        .from(userMember)
        .innerJoin(
          oaMember,
          and(eq(userMember.chatId, oaMember.chatId), eq(oaMember.oaId, input.oaId)),
        )
        .innerJoin(chat, eq(chat.id, userMember.chatId))
        .where(
          and(
            eq(chat.type, 'oa'),
            isNotNull(userMember.userId),
            inArray(userMember.userId, userIds),
          ),
        )

      for (const chatRow of chatRows) {
        if (!chatRow.userId || !chatRow.lastMessageAt) continue
        const existing = chatByUserId.get(chatRow.userId)
        if (!existing || chatRow.lastMessageAt > existing.lastInteractionAt) {
          chatByUserId.set(chatRow.userId, { lastInteractionAt: chatRow.lastMessageAt })
        }
      }
    }

    const exportedAt = input.exportedAt.toISOString()
    const rows: OAContactExportRow[] = contacts
      .map((contact) => {
        const tags = (tagsByUserId.get(contact.userId) ?? []).sort((a, b) =>
          a.name === b.name ? a.id.localeCompare(b.id) : a.name.localeCompare(b.name),
        )
        const chatInfo = chatByUserId.get(contact.userId)

        return {
          providerScopedUserId: contact.userId,
          displayName: contact.displayName ?? '',
          friendshipStatus: contact.friendshipStatus,
          lastInteractionAt: chatInfo?.lastInteractionAt ?? '',
          chatStatus: chatInfo ? ('active' as const) : ('no_chat' as const),
          tagIds: tags.map((tag) => tag.id),
          tagNames: tags.map((tag) => tag.name),
          managerNoteText: contact.noteText ?? '',
          exportedAt,
        }
      })
      .sort((a, b) =>
        a.displayName === b.displayName
          ? a.providerScopedUserId.localeCompare(b.providerScopedUserId)
          : a.displayName.localeCompare(b.displayName),
      )

    return {
      filename: filenameFor(account.uniqueId, input.exportedAt),
      csv: buildOAContactExportCsv(rows),
    }
  }

  return { exportContactsCsv }
}
