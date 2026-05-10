import { useEffect, useState } from 'react'
import { SizableText, XStack, YStack } from 'tamagui'
import { Avatar } from '~/interface/avatars/Avatar'
import { Button } from '~/interface/buttons/Button'
import { dialogConfirm } from '~/interface/dialogs/actions'
import { Input } from '~/interface/forms/Input'
import { TextArea } from '~/interface/forms/TextArea'
import { showToast } from '~/interface/toast/Toast'
import { useManagerOAContactCRM } from './useManagerOAContactCRM'
import type { ManagerOAContactListItem, ManagerOAContactTag } from './useManagerOAContacts'

type Props = {
  oaId: string
  name: string
  image: string | null
  contact?: ManagerOAContactListItem | null
}

function formatLastInteraction(
  contact: ManagerOAContactListItem | null | undefined,
): string {
  if (!contact) return 'Unknown'
  const ts = contact.lastInteractionAt
  if (ts == null) return 'No chat yet'
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

function TagChip({
  tag,
  actionLabel,
  onAction,
}: {
  tag: ManagerOAContactTag
  actionLabel: string
  onAction: () => void
}) {
  return (
    <XStack
      key={tag.id}
      items="center"
      gap="$1"
      px="$2"
      py="$1"
      rounded="$2"
      bg="$color3"
      maxW={180}
    >
      <SizableText size="$1" numberOfLines={1}>
        {tag.name}
      </SizableText>
      <Button size="$2" variant="transparent" onPress={onAction}>
        {actionLabel}
      </Button>
    </XStack>
  )
}

export function ManagerOAProfilePanel({ oaId, name, image, contact }: Props) {
  const [noteDraft, setNoteDraft] = useState(contact?.noteText ?? '')
  const [newTagName, setNewTagName] = useState('')
  const [editingTagId, setEditingTagId] = useState<string | null>(null)
  const [editingTagName, setEditingTagName] = useState('')
  const [isSavingNote, setIsSavingNote] = useState(false)
  const [isSavingTag, setIsSavingTag] = useState(false)
  const [pendingRemovedAssignmentIds, setPendingRemovedAssignmentIds] = useState<string[]>(
    [],
  )
  const [pendingDeletedTagIds, setPendingDeletedTagIds] = useState<string[]>([])
  const visibleContact = contact
    ? {
        ...contact,
        tags: contact.tags.filter(
          (tag) =>
            !pendingRemovedAssignmentIds.includes(tag.assignmentId) &&
            !pendingDeletedTagIds.includes(tag.id),
        ),
      }
    : contact
  const visibleTags = visibleContact?.tags ?? []
  const crm = useManagerOAContactCRM(oaId, visibleContact)
  const availableTags = crm.availableTags.filter(
    (tag) => !pendingDeletedTagIds.includes(tag.id),
  )
  const allTags = crm.allTags.filter((tag) => !pendingDeletedTagIds.includes(tag.id))

  useEffect(() => {
    setNoteDraft(contact?.noteText ?? '')
  }, [contact?.id, contact?.noteText])

  useEffect(() => {
    setPendingRemovedAssignmentIds([])
    setPendingDeletedTagIds([])
  }, [contact?.id])

  const saveNote = async () => {
    if (!contact || isSavingNote) return
    setIsSavingNote(true)
    try {
      await crm.saveNote(noteDraft)
      showToast('Note saved', { type: 'success' })
    } catch {
      showToast('Note failed to save', { type: 'error' })
    } finally {
      setIsSavingNote(false)
    }
  }

  const createTag = async () => {
    if (isSavingTag || !newTagName.trim()) return
    setIsSavingTag(true)
    try {
      await crm.createTag(newTagName)
      setNewTagName('')
      showToast('Tag created', { type: 'success' })
    } catch {
      showToast('Tag failed to save', { type: 'error' })
    } finally {
      setIsSavingTag(false)
    }
  }

  const renameTag = async () => {
    if (!editingTagId || !editingTagName.trim()) return
    try {
      await crm.renameTag(editingTagId, editingTagName)
      setEditingTagId(null)
      setEditingTagName('')
      showToast('Tag renamed', { type: 'success' })
    } catch {
      showToast('Tag failed to save', { type: 'error' })
    }
  }

  const deleteTag = async (id: string) => {
    const confirmed = await dialogConfirm({
      title: 'Delete tag?',
      description: 'This deletes the tag definition and removes it from every contact.',
    })
    if (!confirmed) return

    setPendingDeletedTagIds((ids) => (ids.includes(id) ? ids : [...ids, id]))

    try {
      await crm.deleteTag(id)
      showToast('Tag deleted', { type: 'success' })
    } catch {
      setPendingDeletedTagIds((ids) => ids.filter((tagId) => tagId !== id))
      showToast('Tag failed to delete', { type: 'error' })
    }
  }

  const removeTag = async (assignmentId: string) => {
    setPendingRemovedAssignmentIds((ids) =>
      ids.includes(assignmentId) ? ids : [...ids, assignmentId],
    )

    try {
      await crm.removeTag(assignmentId)
    } catch {
      setPendingRemovedAssignmentIds((ids) => ids.filter((id) => id !== assignmentId))
      showToast('Tag failed to remove', { type: 'error' })
    }
  }

  return (
    <YStack
      width={280}
      shrink={0}
      p="$5"
      gap="$4"
      borderLeftWidth={1}
      borderColor="$borderColor"
      $platform-web={{ overflowY: 'auto' }}
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
        <ProfileField label="Last interaction" value={formatLastInteraction(contact)} />
        <ProfileField label="Chat status" value={formatChatStatus(contact)} />
      </YStack>

      {contact ? (
        <>
          <YStack gap="$2">
            <SizableText size="$2" fontWeight="700">
              Tags
            </SizableText>
            <XStack gap="$1" flexWrap="wrap">
              {visibleTags.length === 0 ? (
                <SizableText size="$2" color="$color10">
                  No tags
                </SizableText>
              ) : (
                visibleTags.map((tag) => (
                  <TagChip
                    key={tag.id}
                    tag={tag}
                    actionLabel="Remove"
                    onAction={() => removeTag(tag.assignmentId)}
                  />
                ))
              )}
            </XStack>
            <YStack gap="$2">
              {availableTags.map((tag) => (
                <Button
                  key={tag.id}
                  size="$2"
                  variant="outlined"
                  onPress={() => crm.assignTag(tag.id)}
                >
                  Add {tag.name}
                </Button>
              ))}
            </YStack>
            <XStack gap="$2" items="center">
              <Input
                flex={1}
                value={newTagName}
                onChangeText={setNewTagName}
                placeholder="New tag"
                size="$3"
              />
              <Button size="$3" onPress={createTag} disabled={!newTagName.trim() || isSavingTag}>
                Create
              </Button>
            </XStack>
            <YStack gap="$2">
              {allTags.map((tag) =>
                editingTagId === tag.id ? (
                  <XStack key={tag.id} gap="$2" items="center">
                    <Input
                      flex={1}
                      value={editingTagName}
                      onChangeText={setEditingTagName}
                      placeholder="Tag name"
                      size="$3"
                    />
                    <Button size="$3" onPress={renameTag} disabled={!editingTagName.trim()}>
                      Save
                    </Button>
                  </XStack>
                ) : (
                  <XStack key={tag.id} gap="$2" items="center" justify="space-between">
                    <SizableText size="$2" numberOfLines={1}>
                      {tag.name}
                    </SizableText>
                    <XStack gap="$1">
                      <Button
                        size="$2"
                        variant="transparent"
                        onPress={() => {
                          setEditingTagId(tag.id)
                          setEditingTagName(tag.name)
                        }}
                      >
                        Rename
                      </Button>
                      <Button
                        size="$2"
                        variant="transparent"
                        onPress={() => deleteTag(tag.id)}
                      >
                        Delete
                      </Button>
                    </XStack>
                  </XStack>
                ),
              )}
            </YStack>
          </YStack>

          <YStack gap="$2">
            <SizableText size="$2" fontWeight="700">
              Manager note
            </SizableText>
            <TextArea
              value={noteDraft}
              onChangeText={setNoteDraft}
              placeholder="Add a private note"
              minH={96}
            />
            <Button onPress={saveNote} disabled={isSavingNote}>
              Save note
            </Button>
          </YStack>
        </>
      ) : null}
    </YStack>
  )
}
