import { useState } from 'react'
import { ScrollView, SizableText, XStack, YStack } from 'tamagui'
import { Button } from '~/interface/buttons/Button'
import { Pressable } from '~/interface/buttons/Pressable'
import { dialogConfirm } from '~/interface/dialogs/actions'
import { showToast } from '~/interface/toast/Toast'
import { ManagerOAFilterModal } from './ManagerOAFilterModal'
import { useManagerOAChatFilters, type ChatFilterItem } from './useManagerOAChatFilters'

type Props = {
  oaId: string
  onBackToChat: () => void
}

export function ManagerOACustomFiltersPage({ oaId, onBackToChat }: Props) {
  const { filters, allTags, createFilter, updateFilter, deleteFilter } =
    useManagerOAChatFilters(oaId)
  const [modalOpen, setModalOpen] = useState(false)
  const [editingFilter, setEditingFilter] = useState<ChatFilterItem | null>(null)

  const handleCreate = () => {
    setEditingFilter(null)
    setModalOpen(true)
  }

  const handleEdit = (filter: ChatFilterItem) => {
    setEditingFilter(filter)
    setModalOpen(true)
  }

  const handleDelete = async (filter: ChatFilterItem) => {
    const confirmed = await dialogConfirm({
      title: 'Delete filter?',
      description: `Delete "${filter.name}"? This cannot be undone.`,
    })
    if (!confirmed) return
    try {
      await deleteFilter(filter.id)
      showToast('Filter deleted', { type: 'success' })
    } catch {
      showToast('Failed to delete filter', { type: 'error' })
    }
  }

  const handleSave = async (name: string, matchMode: 'all' | 'any', tagIds: string[]) => {
    try {
      if (editingFilter) {
        await updateFilter(
          editingFilter.id,
          name,
          matchMode,
          tagIds,
          editingFilter.sortOrder,
        )
        showToast('Filter updated', { type: 'success' })
      } else {
        await createFilter(name, matchMode, tagIds)
        showToast('Filter created', { type: 'success' })
      }
      setModalOpen(false)
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to save filter', {
        type: 'error',
      })
    }
  }

  return (
    <YStack flex={1} p="$5" gap="$4" $platform-web={{ overflowY: 'auto' }}>
      <XStack items="center" justify="space-between">
        <XStack items="center" gap="$3">
          <Pressable
            role="button"
            aria-label="Back to chat"
            onPress={onBackToChat}
            cursor="pointer"
          >
            <SizableText size="$2" color="$color10">
              ← Back to chat
            </SizableText>
          </Pressable>
          <SizableText size="$6" fontWeight="700">
            Custom Filters
          </SizableText>
        </XStack>
        <Button size="$3" onPress={handleCreate} disabled={filters.length >= 20}>
          New filter
        </Button>
      </XStack>

      <SizableText size="$2" color="$color10">
        Create filters to quickly find chats by tag. You can create up to 20 filters.
      </SizableText>

      {filters.length === 0 ? (
        <YStack py="$6" items="center">
          <SizableText size="$3" color="$color10">
            No custom filters yet
          </SizableText>
        </YStack>
      ) : (
        <ScrollView>
          <YStack gap="$2">
            {filters.map((filter) => (
              <XStack
                key={filter.id}
                p="$3"
                rounded="$3"
                borderWidth={1}
                borderColor="$borderColor"
                items="center"
                justify="space-between"
                gap="$3"
              >
                <YStack flex={1} gap="$1">
                  <SizableText size="$3" fontWeight="600">
                    {filter.name}
                  </SizableText>
                  <XStack gap="$2" items="center">
                    <SizableText size="$1" color="$color10">
                      {filter.matchMode === 'all' ? 'Match all' : 'Match any'} ·{' '}
                      {filter.tagIds.length} tag{filter.tagIds.length !== 1 ? 's' : ''}
                    </SizableText>
                  </XStack>
                  <XStack gap="$1" flexWrap="wrap" mt="$1">
                    {filter.tagIds.map((tagId) => {
                      const tag = allTags.find((t) => t.id === tagId)
                      return tag ? (
                        <YStack key={tagId} px="$2" py="$1" rounded="$2" bg="$color3">
                          <SizableText size="$1">{tag.name}</SizableText>
                        </YStack>
                      ) : null
                    })}
                  </XStack>
                </YStack>
                <XStack gap="$2">
                  <Button size="$2" variant="outlined" onPress={() => handleEdit(filter)}>
                    Edit
                  </Button>
                  <Button
                    size="$2"
                    variant="outlined"
                    onPress={() => handleDelete(filter)}
                  >
                    Delete
                  </Button>
                </XStack>
              </XStack>
            ))}
          </YStack>
        </ScrollView>
      )}

      {modalOpen && (
        <ManagerOAFilterModal
          oaId={oaId}
          filter={editingFilter}
          allTags={allTags}
          onSave={handleSave}
          onClose={() => setModalOpen(false)}
        />
      )}
    </YStack>
  )
}
