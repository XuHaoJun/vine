import { useMemo, useState } from 'react'
import { SizableText, XStack, YStack } from 'tamagui'
import { Button } from '~/interface/buttons/Button'
import { Pressable } from '~/interface/buttons/Pressable'
import { Input } from '~/interface/forms/Input'
import { useManagerOAChats } from './useManagerOAChats'
import { useManagerOAContacts } from './useManagerOAContacts'
import type { ChatFilterItem } from './useManagerOAChatFilters'

type TagOption = {
  id: string
  name: string
  color: string | null | undefined
}

type Props = {
  oaId: string
  filter: ChatFilterItem | null
  allTags: TagOption[]
  onSave: (name: string, matchMode: 'all' | 'any', tagIds: string[]) => Promise<void>
  onClose: () => void
}

export function ManagerOAFilterModal({ oaId, filter, allTags, onSave, onClose }: Props) {
  const [name, setName] = useState(filter?.name ?? '')
  const [matchMode, setMatchMode] = useState<'all' | 'any'>(filter?.matchMode ?? 'any')
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>(filter?.tagIds ?? [])
  const [isSaving, setIsSaving] = useState(false)

  const { chats } = useManagerOAChats(oaId, '')
  const { contacts } = useManagerOAContacts(oaId, '', chats)

  const hitCount = useMemo(() => {
    if (selectedTagIds.length === 0) return chats.length

    const chatUserIds = new Set(chats.map((c) => c.userId))
    let count = 0
    for (const contact of contacts) {
      if (!chatUserIds.has(contact.userId)) continue
      const contactTagIds = new Set(contact.tags.map((t) => t.id))
      const matches =
        matchMode === 'all'
          ? selectedTagIds.every((id) => contactTagIds.has(id))
          : selectedTagIds.some((id) => contactTagIds.has(id))
      if (matches) count++
    }
    return count
  }, [chats, contacts, selectedTagIds, matchMode])

  const toggleTag = (tagId: string) => {
    setSelectedTagIds((prev) =>
      prev.includes(tagId) ? prev.filter((id) => id !== tagId) : [...prev, tagId],
    )
  }

  const handleSave = async () => {
    setIsSaving(true)
    try {
      await onSave(name, matchMode, selectedTagIds)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <YStack
      position="absolute"
      $platform-web={{ position: 'fixed' as any }}
      t={0}
      l={0}
      r={0}
      b={0}
      bg="rgba(0,0,0,0.4)"
      items="center"
      justify="center"
      z={100}
    >
      <YStack
        bg="$background"
        rounded="$4"
        p="$5"
        gap="$4"
        width={420}
        maxH="80%"
        $platform-web={{ overflowY: 'auto' }}
      >
        <SizableText size="$5" fontWeight="700">
          {filter ? 'Edit filter' : 'New filter'}
        </SizableText>

        <YStack gap="$2">
          <SizableText size="$2" fontWeight="600">
            Filter name
          </SizableText>
          <Input
            value={name}
            onChangeText={setName}
            placeholder="e.g. VIP Customers"
            size="$3"
          />
        </YStack>

        <YStack gap="$2">
          <SizableText size="$2" fontWeight="600">
            Match mode
          </SizableText>
          <XStack gap="$2">
            <Button
              size="$3"
              flex={1}
              variant={matchMode === 'any' ? undefined : 'outlined'}
              onPress={() => setMatchMode('any')}
            >
              Match any (OR)
            </Button>
            <Button
              size="$3"
              flex={1}
              variant={matchMode === 'all' ? undefined : 'outlined'}
              onPress={() => setMatchMode('all')}
            >
              Match all (AND)
            </Button>
          </XStack>
        </YStack>

        <YStack gap="$2">
          <SizableText size="$2" fontWeight="600">
            Tags
          </SizableText>
          {allTags.length === 0 ? (
            <SizableText size="$2" color="$color10">
              No tags created yet. Create tags in the profile panel first.
            </SizableText>
          ) : (
            <XStack gap="$2" flexWrap="wrap">
              {allTags.map((tag) => {
                const selected = selectedTagIds.includes(tag.id)
                return (
                  <Pressable
                    key={tag.id}
                    role="button"
                    aria-label={`${selected ? 'Remove' : 'Add'} tag ${tag.name}`}
                    onPress={() => toggleTag(tag.id)}
                    px="$3"
                    py="$2"
                    rounded="$2"
                    bg={selected ? '$color7' : '$color3'}
                    cursor="pointer"
                    hoverStyle={{ bg: selected ? '$color8' : '$color4' }}
                  >
                    <SizableText size="$2" color={selected ? '$color1' : undefined}>
                      {tag.name}
                    </SizableText>
                  </Pressable>
                )
              })}
            </XStack>
          )}
        </YStack>

        <XStack p="$3" rounded="$3" bg="$color3" items="center" justify="center">
          <SizableText size="$3" fontWeight="600">
            {hitCount} chat{hitCount !== 1 ? 's' : ''} match
          </SizableText>
        </XStack>

        <XStack gap="$3" justify="flex-end">
          <Button size="$3" variant="outlined" onPress={onClose}>
            Cancel
          </Button>
          <Button size="$3" onPress={handleSave} disabled={!name.trim() || isSaving}>
            {filter ? 'Save' : 'Create'}
          </Button>
        </XStack>
      </YStack>
    </YStack>
  )
}
