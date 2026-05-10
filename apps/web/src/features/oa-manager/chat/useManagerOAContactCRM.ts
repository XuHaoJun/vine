import { oaContactTagsByOfficialAccountId } from '@vine/zero-schema/queries/oaContactTag'
import { useCallback, useMemo } from 'react'
import { useZeroQuery, zero } from '~/zero/client'
import type { ManagerOAContactListItem } from './useManagerOAContacts'

const TAG_COLORS = ['#0f766e', '#2563eb', '#7c3aed', '#c2410c', '#be123c'] as const

export function useManagerOAContactCRM(
  oaId: string,
  contact: ManagerOAContactListItem | null | undefined,
) {
  const [allTags, { type }] = useZeroQuery(
    oaContactTagsByOfficialAccountId,
    { oaId },
    { enabled: Boolean(oaId) },
  )

  const assignedTagIds = useMemo(
    () => new Set(contact?.tags.map((tag) => tag.id) ?? []),
    [contact?.tags],
  )

  const availableTags = useMemo(
    () => (allTags ?? []).filter((tag) => !assignedTagIds.has(tag.id)),
    [allTags, assignedTagIds],
  )

  const saveNote = useCallback(
    async (noteText: string) => {
      if (!contact) return
      await zero.mutate.oaContactProfile.saveNote({
        oaId,
        userId: contact.userId,
        noteText,
        updatedAt: Date.now(),
      })
    },
    [contact, oaId],
  )

  const createTag = useCallback(
    async (name: string) => {
      const trimmed = name.trim()
      if (!trimmed) return
      const now = Date.now()
      const color = TAG_COLORS[(allTags?.length ?? 0) % TAG_COLORS.length]
      await zero.mutate.oaContactTag.create({
        id: crypto.randomUUID(),
        oaId,
        name: trimmed,
        color,
        createdAt: now,
        updatedAt: now,
      })
    },
    [allTags?.length, oaId],
  )

  const renameTag = useCallback(
    async (id: string, name: string) => {
      const trimmed = name.trim()
      if (!trimmed) return
      await zero.mutate.oaContactTag.rename({
        id,
        oaId,
        name: trimmed,
        updatedAt: Date.now(),
      })
    },
    [oaId],
  )

  const deleteTag = useCallback(
    async (id: string) => {
      await zero.mutate.oaContactTag.deleteTag({ id, oaId })
    },
    [oaId],
  )

  const assignTag = useCallback(
    async (tagId: string) => {
      if (!contact) return
      await zero.mutate.oaContactTagAssignment.assign({
        id: crypto.randomUUID(),
        oaId,
        userId: contact.userId,
        tagId,
        createdAt: Date.now(),
      })
    },
    [contact, oaId],
  )

  const removeTag = useCallback(
    async (tagId: string) => {
      if (!contact) return
      await zero.mutate.oaContactTagAssignment.remove({
        oaId,
        userId: contact.userId,
        tagId,
      })
    },
    [contact, oaId],
  )

  return {
    allTags: allTags ?? [],
    availableTags,
    isLoadingTags: type === 'unknown',
    saveNote,
    createTag,
    renameTag,
    deleteTag,
    assignTag,
    removeTag,
  }
}
