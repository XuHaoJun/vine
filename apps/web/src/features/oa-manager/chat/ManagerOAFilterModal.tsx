import type { ChatFilterItem } from './useManagerOAChatFilters'

type Tag = { id: string; name: string; color: string }

type Props = {
  oaId: string
  filter: ChatFilterItem | null
  allTags: Tag[]
  onSave: (name: string, matchMode: 'all' | 'any', tagIds: string[]) => Promise<void>
  onClose: () => void
}

export function ManagerOAFilterModal({ filter }: Props) {
  return (
    <div>
      Filter modal stub — will be implemented in Task 8.
      {filter ? ` Editing: ${filter.name}` : ' Creating new filter'}
    </div>
  )
}
