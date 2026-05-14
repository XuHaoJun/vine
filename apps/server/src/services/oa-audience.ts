import { schema } from '@vine/db'
import {
  oaContactProfile,
  oaContactTag,
  oaContactTagAssignment,
  oaFriendship,
} from '@vine/db/schema-oa'
import { chat, chatMember, userPublic } from '@vine/db/schema-public'
import {
  evaluateAudienceQuery,
  validateAudienceQuery,
  type AudienceContact,
  type AudienceQueryJson,
} from '@vine/zero-schema'
import { and, eq, isNotNull } from 'drizzle-orm'
import { alias } from 'drizzle-orm/pg-core'
import type { NodePgDatabase } from 'drizzle-orm/node-postgres'

export type OAAudienceServiceDeps = {
  db: NodePgDatabase<typeof schema>
  loadContactsForTest?: (oaId: string) => Promise<AudienceContact[]>
}

export type OAAudienceResolveResult =
  | { ok: true; userIds: string[] }
  | { ok: false; code: 'INVALID_AUDIENCE_QUERY'; message: string }

export type OAAudiencePreviewResult =
  | { ok: true; count: number }
  | { ok: false; code: 'INVALID_AUDIENCE_QUERY'; message: string }

async function loadContactsForOa(
  deps: OAAudienceServiceDeps,
  oaId: string,
): Promise<AudienceContact[]> {
  if (deps.loadContactsForTest) return deps.loadContactsForTest(oaId)

  const friendships = await deps.db
    .select({
      userId: oaFriendship.userId,
      status: oaFriendship.status,
      displayName: userPublic.name,
      noteText: oaContactProfile.noteText,
    })
    .from(oaFriendship)
    .leftJoin(userPublic, eq(userPublic.id, oaFriendship.userId))
    .leftJoin(
      oaContactProfile,
      and(
        eq(oaContactProfile.oaId, oaFriendship.oaId),
        eq(oaContactProfile.userId, oaFriendship.userId),
      ),
    )
    .where(eq(oaFriendship.oaId, oaId))

  const assignments = await deps.db
    .select({
      userId: oaContactTagAssignment.userId,
      tagId: oaContactTagAssignment.tagId,
      tagName: oaContactTag.name,
    })
    .from(oaContactTagAssignment)
    .innerJoin(oaContactTag, eq(oaContactTag.id, oaContactTagAssignment.tagId))
    .where(eq(oaContactTagAssignment.oaId, oaId))

  const tagsByUserId = new Map<string, { id: string; name: string }[]>()
  for (const assignment of assignments) {
    const tags = tagsByUserId.get(assignment.userId) ?? []
    tags.push({ id: assignment.tagId, name: assignment.tagName })
    tagsByUserId.set(assignment.userId, tags)
  }

  const oaMember = alias(chatMember, 'oaAudienceOaMember')
  const userMember = alias(chatMember, 'oaAudienceUserMember')
  const chatRows = await deps.db
    .select({
      userId: userMember.userId,
      lastMessageAt: chat.lastMessageAt,
      lastReadAt: userMember.lastReadAt,
    })
    .from(userMember)
    .innerJoin(
      oaMember,
      and(eq(userMember.chatId, oaMember.chatId), eq(oaMember.oaId, oaId)),
    )
    .innerJoin(chat, eq(chat.id, userMember.chatId))
    .where(and(eq(chat.type, 'oa'), isNotNull(userMember.userId)))

  const chatByUserId = new Map<
    string,
    { lastMessageAt: string | null; lastReadAt: string | null }
  >()
  for (const row of chatRows) {
    if (!row.userId) continue
    const existing = chatByUserId.get(row.userId)
    if (
      !existing ||
      (row.lastMessageAt &&
        (!existing.lastMessageAt || row.lastMessageAt > existing.lastMessageAt))
    ) {
      chatByUserId.set(row.userId, {
        lastMessageAt: row.lastMessageAt,
        lastReadAt: row.lastReadAt,
      })
    }
  }

  return friendships.map((friend) => {
    const tags = tagsByUserId.get(friend.userId) ?? []
    const chatRow = chatByUserId.get(friend.userId)
    const hasUnread = Boolean(
      chatRow?.lastMessageAt &&
      (!chatRow.lastReadAt || chatRow.lastReadAt < chatRow.lastMessageAt),
    )

    return {
      friendship: { status: friend.status },
      providerUserId: friend.userId,
      displayName: friend.displayName ?? '',
      tags: {
        ids: tags.map((tag) => tag.id),
        names: tags.map((tag) => tag.name),
      },
      lastInteractionAt: chatRow?.lastMessageAt ?? null,
      chat: { status: chatRow ? 'active' : 'no_chat', unread: hasUnread },
      note: { exists: Boolean(friend.noteText && friend.noteText.length > 0) },
    }
  })
}

export function createOAAudienceService(deps: OAAudienceServiceDeps) {
  function deliveryQuery(query: AudienceQueryJson): AudienceQueryJson {
    return {
      $and: [{ 'friendship.status': 'friend' }, query],
    }
  }

  async function resolveRecipients(input: {
    oaId: string
    query: AudienceQueryJson
  }): Promise<OAAudienceResolveResult> {
    const resolvedQuery = deliveryQuery(input.query)
    const validation = validateAudienceQuery(resolvedQuery)
    if (!validation.ok) {
      return {
        ok: false,
        code: 'INVALID_AUDIENCE_QUERY',
        message: validation.error,
      }
    }

    const contacts = await loadContactsForOa(deps, input.oaId)
    return {
      ok: true,
      userIds: contacts
        .filter((contact) => evaluateAudienceQuery(resolvedQuery, contact))
        .map((contact) => contact.providerUserId),
    }
  }

  async function preview(input: {
    oaId: string
    query: AudienceQueryJson
  }): Promise<OAAudiencePreviewResult> {
    const result = await resolveRecipients(input)
    if (!result.ok) return result
    return { ok: true, count: result.userIds.length }
  }

  return { preview, resolveRecipients }
}
