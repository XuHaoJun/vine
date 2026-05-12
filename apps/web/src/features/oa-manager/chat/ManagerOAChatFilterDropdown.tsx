import { useState } from 'react'
import { SizableText, XStack, YStack } from 'tamagui'
import { Pressable } from '~/interface/buttons/Pressable'
import type { ChatFilterItem } from './useManagerOAChatFilters'

export type ActiveFilter =
  | { type: 'all' }
  | { type: 'unread' }
  | { type: 'custom'; filterId: string }

type Props = {
  activeFilter: ActiveFilter
  onFilterChange: (filter: ActiveFilter) => void
  customFilters: ChatFilterItem[]
}

function getFilterLabel(active: ActiveFilter, customFilters: ChatFilterItem[]): string {
  if (active.type === 'all') return 'All'
  if (active.type === 'unread') return 'Unread'
  const filter = customFilters.find((f) => f.id === active.filterId)
  return filter?.name ?? 'All'
}

export function ManagerOAChatFilterDropdown({
  activeFilter,
  onFilterChange,
  customFilters,
}: Props) {
  const [open, setOpen] = useState(false)

  const selectFilter = (filter: ActiveFilter) => {
    onFilterChange(filter)
    setOpen(false)
  }

  return (
    <YStack position="relative">
      <Pressable
        role="button"
        aria-label="Select chat filter"
        onPress={() => setOpen((prev) => !prev)}
        px="$3"
        py="$2"
        rounded="$2"
        bg="$color2"
        cursor="pointer"
        hoverStyle={{ bg: '$color3' }}
      >
        <XStack items="center" justify="space-between">
          <SizableText size="$2" fontWeight="600">
            {getFilterLabel(activeFilter, customFilters)}
          </SizableText>
          <SizableText size="$1" color="$color10">
            {open ? '▲' : '▼'}
          </SizableText>
        </XStack>
      </Pressable>

      {open && (
        <YStack
          position="absolute"
          t="100%"
          l={0}
          r={0}
          mt="$1"
          bg="$background"
          rounded="$3"
          borderWidth={1}
          borderColor="$borderColor"
          z={50}
          maxH={300}
          $platform-web={{ overflowY: 'auto' } as any}
        >
          <FilterOption
            label="All"
            active={activeFilter.type === 'all'}
            onPress={() => selectFilter({ type: 'all' })}
          />
          <FilterOption
            label="Unread"
            active={activeFilter.type === 'unread'}
            onPress={() => selectFilter({ type: 'unread' })}
          />

          {customFilters.length > 0 && (
            <>
              <YStack
                px="$3"
                py="$2"
                borderTopWidth={1}
                borderColor="$borderColor"
              >
                <SizableText size="$1" color="$color10" fontWeight="600">
                  Custom filters
                </SizableText>
              </YStack>
              {customFilters.map((filter) => (
                <FilterOption
                  key={filter.id}
                  label={filter.name}
                  active={
                    activeFilter.type === 'custom' &&
                    activeFilter.filterId === filter.id
                  }
                  onPress={() =>
                    selectFilter({ type: 'custom', filterId: filter.id })
                  }
                />
              ))}
            </>
          )}
        </YStack>
      )}
    </YStack>
  )
}

function FilterOption({
  label,
  active,
  onPress,
}: {
  label: string
  active: boolean
  onPress: () => void
}) {
  return (
    <Pressable
      role="button"
      aria-label={`Filter: ${label}`}
      onPress={onPress}
      px="$3"
      py="$2"
      cursor="pointer"
      bg={active ? '$color3' : 'transparent'}
      hoverStyle={{ bg: active ? '$color3' : '$color2' }}
    >
      <SizableText size="$2" fontWeight={active ? '700' : '400'}>
        {label}
      </SizableText>
    </Pressable>
  )
}
