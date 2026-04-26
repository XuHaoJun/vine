import { useState } from 'react'
import { ScrollView, SizableText, XStack, YStack } from 'tamagui'

import { Button } from '~/interface/buttons/Button'
import { Input } from '~/interface/forms/Input'
import { showToast } from '~/interface/toast/Toast'
import { useTanQuery, useTanMutation, useTanQueryClient } from '~/query'
import { stickerMarketAdminClient } from './client'

export function AdminFeaturedShelvesPage() {
  const queryClient = useTanQueryClient()
  const [editingShelf, setEditingShelf] = useState<any | null>(null)
  const [newSlug, setNewSlug] = useState('')
  const [newTitle, setNewTitle] = useState('')
  const [newPackageIds, setNewPackageIds] = useState('')
  const [newStartsAt, setNewStartsAt] = useState('')
  const [newEndsAt, setNewEndsAt] = useState('')

  const { data, isLoading } = useTanQuery({
    queryKey: ['sticker-market', 'admin', 'featured-shelves'],
    queryFn: () => stickerMarketAdminClient.listFeaturedShelves({}),
  })

  const shelves = data?.shelves ?? []

  const invalidate = () => {
    queryClient.invalidateQueries({
      queryKey: ['sticker-market', 'admin', 'featured-shelves'],
    })
  }

  const upsertMutation = useTanMutation({
    mutationFn: (params: {
      id: string
      slug: string
      title: string
      packageIds: string[]
      startsAt: string
      endsAt: string
    }) => stickerMarketAdminClient.upsertFeaturedShelf(params),
    onSuccess: () => {
      invalidate()
      setEditingShelf(null)
      setNewSlug('')
      setNewTitle('')
      setNewPackageIds('')
      setNewStartsAt('')
      setNewEndsAt('')
      showToast('精選專區已儲存', { type: 'success' })
    },
    onError: () => showToast('儲存失敗', { type: 'error' }),
  })

  const publishMutation = useTanMutation({
    mutationFn: (id: string) => stickerMarketAdminClient.publishFeaturedShelf({ id }),
    onSuccess: () => {
      invalidate()
      showToast('已發布', { type: 'success' })
    },
    onError: () => showToast('發布失敗', { type: 'error' }),
  })

  const archiveMutation = useTanMutation({
    mutationFn: (id: string) => stickerMarketAdminClient.archiveFeaturedShelf({ id }),
    onSuccess: () => {
      invalidate()
      showToast('已封存', { type: 'success' })
    },
    onError: () => showToast('封存失敗', { type: 'error' }),
  })

  const startEdit = (shelf: any) => {
    setEditingShelf(shelf)
    setNewSlug(shelf.slug)
    setNewTitle(shelf.title)
    setNewPackageIds((shelf.items ?? []).map((i: any) => i.packageId).join(','))
    setNewStartsAt(shelf.startsAt ?? '')
    setNewEndsAt(shelf.endsAt ?? '')
  }

  const handleSave = () => {
    upsertMutation.mutate({
      id: editingShelf?.id ?? '',
      slug: newSlug,
      title: newTitle,
      packageIds: newPackageIds
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
      startsAt: newStartsAt,
      endsAt: newEndsAt,
    })
  }

  return (
    <YStack flex={1} bg="$background">
      <XStack
        px="$4"
        py="$3"
        items="center"
        borderBottomWidth={1}
        borderBottomColor="$color4"
      >
        <SizableText size="$6" fontWeight="700" color="$color12">
          精選專區管理
        </SizableText>
      </XStack>

      <ScrollView flex={1}>
        <YStack p="$4" gap="$3">
          {isLoading && (
            <SizableText size="$4" color="$color10" text="center" mt="$8">
              載入中...
            </SizableText>
          )}

          {!isLoading && (
            <Button
              variant="outlined"
              onPress={() => {
                setEditingShelf({ id: '' })
                setNewSlug('')
                setNewTitle('')
                setNewPackageIds('')
                setNewStartsAt('')
                setNewEndsAt('')
              }}
            >
              新增專區
            </Button>
          )}

          {/* Create/Edit form */}
          {editingShelf !== null && (
            <YStack bg="$color2" rounded="$4" p="$3" gap="$2">
              <Input
                value={newSlug}
                onChangeText={setNewSlug}
                placeholder="Slug (例如: summer-2026)"
              />
              <Input
                value={newTitle}
                onChangeText={setNewTitle}
                placeholder="標題"
              />
              <Input
                value={newPackageIds}
                onChangeText={setNewPackageIds}
                placeholder="套件 ID（逗號分隔）"
              />
              <Input
                value={newStartsAt}
                onChangeText={setNewStartsAt}
                placeholder="開始時間 (ISO)"
              />
              <Input
                value={newEndsAt}
                onChangeText={setNewEndsAt}
                placeholder="結束時間 (ISO)"
              />
              <XStack gap="$2">
                <Button
                  variant="outlined"
                  onPress={() => setEditingShelf(null)}
                >
                  取消
                </Button>
                <Button
                  disabled={upsertMutation.isPending || !newTitle || !newSlug}
                  onPress={handleSave}
                >
                  儲存
                </Button>
              </XStack>
            </YStack>
          )}

          {shelves.map((shelf: any) => (
            <YStack
              key={shelf.id}
              bg="$color2"
              rounded="$4"
              p="$3"
              gap="$2"
            >
              <XStack justify="space-between" items="center">
                <YStack flex={1}>
                  <SizableText size="$4" fontWeight="700" color="$color12">
                    {shelf.title}
                  </SizableText>
                  <SizableText size="$3" color="$color10">
                    {shelf.slug}
                  </SizableText>
                </YStack>
                <YStack
                  bg={shelf.status === 'published' ? '$green5' : '$color4'}
                  rounded="$2"
                  px="$2"
                  py="$1"
                >
                  <SizableText size="$2" color="$color11">
                    {shelf.status === 'published' ? '已發布' : shelf.status === 'archived' ? '已封存' : '草稿'}
                  </SizableText>
                </YStack>
              </XStack>

              <SizableText size="$3" color="$color10">
                {(shelf.items ?? []).length} 個套件
              </SizableText>

              {shelf.startsAt && (
                <SizableText size="$2" color="$color10">
                  開始: {shelf.startsAt}
                </SizableText>
              )}
              {shelf.endsAt && (
                <SizableText size="$2" color="$color10">
                  結束: {shelf.endsAt}
                </SizableText>
              )}

              <XStack gap="$2" flexWrap="wrap">
                <Button size="$3" variant="outlined" onPress={() => startEdit(shelf)}>
                  編輯
                </Button>
                {shelf.status !== 'published' && (
                  <Button
                    size="$3"
                    theme="green"
                    disabled={publishMutation.isPending}
                    onPress={() => publishMutation.mutate(shelf.id)}
                  >
                    發布
                  </Button>
                )}
                {shelf.status !== 'archived' && (
                  <Button
                    size="$3"
                    theme="red"
                    disabled={archiveMutation.isPending}
                    onPress={() => archiveMutation.mutate(shelf.id)}
                  >
                    封存
                  </Button>
                )}
              </XStack>
            </YStack>
          ))}

          {!isLoading && shelves.length === 0 && editingShelf === null && (
            <SizableText size="$4" color="$color10" text="center" mt="$4">
              尚無精選專區
            </SizableText>
          )}
        </YStack>
      </ScrollView>
    </YStack>
  )
}
