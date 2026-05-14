import { valibotResolver } from '@hookform/resolvers/valibot'
import { useMemo, useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { ScrollView, SizableText, XStack, YStack } from 'tamagui'
import * as v from 'valibot'
import { Button } from '~/interface/buttons/Button'
import { Pressable } from '~/interface/buttons/Pressable'
import { dialogConfirm } from '~/interface/dialogs/actions'
import { Input } from '~/interface/forms/Input'
import { TextArea } from '~/interface/forms/TextArea'
import { showToast } from '~/interface/toast/Toast'
import {
  defaultAudienceQuery,
  formatAudienceQuery,
  parseAudienceQueryText,
} from './audienceQueryForm'
import {
  useManagerOAAudienceFilters,
  type AudienceFilterItem,
} from './useManagerOAAudienceFilters'

const filterSchema = v.object({
  name: v.pipe(
    v.string(),
    v.nonEmpty('Filter name is required'),
    v.maxLength(64, 'Filter name must be 64 characters or less'),
  ),
  queryJson: v.pipe(
    v.string(),
    v.nonEmpty('Audience query is required'),
    v.check((value) => parseAudienceQueryText(value).ok, 'Invalid audience query'),
  ),
})

type FilterFormData = v.InferInput<typeof filterSchema>

type Props = {
  oaId: string
}

function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleString()
}

export function ManagerOAAudienceFiltersPage({ oaId }: Props) {
  const { filters, previewAudience, createFilter, updateFilter, deleteFilter } =
    useManagerOAAudienceFilters(oaId)
  const [editingFilter, setEditingFilter] = useState<AudienceFilterItem | null>(null)
  const [previewCount, setPreviewCount] = useState<number | null>(null)

  const defaultQueryText = useMemo(() => formatAudienceQuery(defaultAudienceQuery), [])
  const {
    control,
    handleSubmit,
    reset,
    setError,
    formState: { isSubmitting },
  } = useForm<FilterFormData>({
    resolver: valibotResolver(filterSchema),
    defaultValues: {
      name: '',
      queryJson: defaultQueryText,
    },
  })

  const startCreate = () => {
    setEditingFilter(null)
    setPreviewCount(null)
    reset({ name: '', queryJson: defaultQueryText })
  }

  const startEdit = (filter: AudienceFilterItem) => {
    setEditingFilter(filter)
    setPreviewCount(null)
    reset({ name: filter.name, queryJson: formatAudienceQuery(filter.queryJson) })
  }

  const saveFilter = handleSubmit(async (data) => {
    const parsed = parseAudienceQueryText(data.queryJson)
    if (!parsed.ok) {
      setError('queryJson', { message: parsed.error })
      return
    }

    try {
      if (editingFilter) {
        await updateFilter(editingFilter.id, data.name, parsed.query)
        showToast('Audience filter updated', { type: 'success' })
      } else {
        await createFilter(data.name, parsed.query)
        showToast('Audience filter created', { type: 'success' })
      }
      startCreate()
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to save audience filter', {
        type: 'error',
      })
    }
  })

  const previewFilter = handleSubmit(async (data) => {
    const parsed = parseAudienceQueryText(data.queryJson)
    if (!parsed.ok) {
      setError('queryJson', { message: parsed.error })
      return
    }

    try {
      const result = await previewAudience.mutateAsync(parsed.query)
      setPreviewCount(result.count)
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to preview audience', {
        type: 'error',
      })
    }
  })

  const handleDelete = async (filter: AudienceFilterItem) => {
    const confirmed = await dialogConfirm({
      title: 'Delete audience filter?',
      description: `Delete "${filter.name}"? Campaign history will remain unchanged.`,
    })
    if (!confirmed) return

    try {
      await deleteFilter(filter.id)
      if (editingFilter?.id === filter.id) startCreate()
      showToast('Audience filter deleted', { type: 'success' })
    } catch {
      showToast('Failed to delete audience filter', { type: 'error' })
    }
  }

  return (
    <YStack gap="$6">
      <XStack
        gap="$4"
        items="flex-start"
        $platform-web={{ flexWrap: 'wrap' }}
      >
        <YStack flex={1} minW={320} gap="$4">
          <XStack items="center" justify="space-between" gap="$3">
            <YStack gap="$1">
              <SizableText size="$6" fontWeight="700" color="$color12">
                Audience filters
              </SizableText>
              <SizableText size="$2" color="$color10">
                {filters.length}/50 saved
              </SizableText>
            </YStack>
            <Button size="$3" variant="outlined" onPress={startCreate}>
              New
            </Button>
          </XStack>

          {filters.length === 0 ? (
            <YStack py="$6" items="center" borderWidth={1} borderColor="$borderColor" rounded="$3">
              <SizableText size="$3" color="$color10">
                No audience filters
              </SizableText>
            </YStack>
          ) : (
            <ScrollView>
              <YStack gap="$2">
                {filters.map((filter) => (
                  <YStack
                    key={filter.id}
                    p="$3"
                    rounded="$3"
                    borderWidth={1}
                    borderColor={editingFilter?.id === filter.id ? '$color8' : '$borderColor'}
                    gap="$2"
                  >
                    <XStack items="center" justify="space-between" gap="$3">
                      <YStack flex={1} minW={0} gap="$1">
                        <SizableText size="$3" fontWeight="700" color="$color12" numberOfLines={1}>
                          {filter.name}
                        </SizableText>
                        <SizableText size="$1" color="$color10">
                          Updated {formatDate(filter.updatedAt)}
                        </SizableText>
                      </YStack>
                      <XStack gap="$2">
                        <Button size="$2" variant="outlined" onPress={() => startEdit(filter)}>
                          Edit
                        </Button>
                        <Button size="$2" variant="outlined" onPress={() => handleDelete(filter)}>
                          Delete
                        </Button>
                      </XStack>
                    </XStack>
                    <Pressable onPress={() => startEdit(filter)} cursor="pointer">
                      <SizableText size="$1" color="$color10" numberOfLines={2}>
                        {formatAudienceQuery(filter.queryJson)}
                      </SizableText>
                    </Pressable>
                  </YStack>
                ))}
              </YStack>
            </ScrollView>
          )}
        </YStack>

        <YStack
          flex={1}
          minW={360}
          borderWidth={1}
          borderColor="$borderColor"
          rounded="$3"
          p="$4"
          gap="$4"
        >
          <SizableText size="$5" fontWeight="700" color="$color12">
            {editingFilter ? 'Edit filter' : 'New filter'}
          </SizableText>

          <YStack gap="$2">
            <SizableText size="$2" fontWeight="600">
              Name
            </SizableText>
            <Controller
              control={control}
              name="name"
              render={({ field: { onChange, value }, fieldState: { error } }) => (
                <Input
                  value={value}
                  onChangeText={onChange}
                  placeholder="VIP customers"
                  error={error?.message}
                  size="$3"
                  onSubmitEditing={() => saveFilter()}
                />
              )}
            />
          </YStack>

          <YStack gap="$2">
            <SizableText size="$2" fontWeight="600">
              Query JSON
            </SizableText>
            <Controller
              control={control}
              name="queryJson"
              render={({ field: { onChange, value }, fieldState: { error } }) => (
                <TextArea
                  value={value}
                  onChangeText={(next) => {
                    setPreviewCount(null)
                    onChange(next)
                  }}
                  placeholder="Audience query JSON"
                  minH={220}
                  error={error?.message}
                />
              )}
            />
          </YStack>

          <XStack
            p="$3"
            rounded="$3"
            bg="$color3"
            items="center"
            justify="space-between"
            gap="$3"
          >
            <SizableText size="$3" fontWeight="700">
              {previewCount === null ? 'Preview not run' : `${previewCount} recipients`}
            </SizableText>
            <Button
              size="$2"
              variant="outlined"
              onPress={() => previewFilter()}
              disabled={previewAudience.isPending}
            >
              Preview
            </Button>
          </XStack>

          <XStack justify="flex-end" gap="$3">
            {editingFilter ? (
              <Button size="$3" variant="outlined" onPress={startCreate}>
                Cancel
              </Button>
            ) : null}
            <Button size="$3" onPress={() => saveFilter()} disabled={isSubmitting}>
              {editingFilter ? 'Save' : 'Create'}
            </Button>
          </XStack>
        </YStack>
      </XStack>
    </YStack>
  )
}
