import { resolveRichMessageExtensions } from './extensionManager'
import type { MessageDraft, QuickReplyDraft, RichMessageExtension } from './types'

export type RichMessageEditorOptions = {
  value: MessageDraft[]
  onChange(next: MessageDraft[]): void
  extensions: RichMessageExtension[]
  maxMessages?: number
  disabledTypes?: string[]
}

export function createRichMessageEditor(options: RichMessageEditorOptions) {
  const extensions = resolveRichMessageExtensions(options.extensions)
  const byType = new Map(extensions.map((extension) => [extension.type, extension]))
  const disabled = new Set(options.disabledTypes ?? [])
  const canInsert = (type: string) => {
    const extension = byType.get(type)
    if (!extension || extension.status === 'disabled' || disabled.has(type)) return false
    if (
      options.maxMessages !== undefined &&
      options.value.length >= options.maxMessages
    ) {
      return false
    }
    return true
  }
  const emit = (next: MessageDraft[]) => options.onChange(next)

  const commands = {
    insertMessage(type: string) {
      if (!canInsert(type)) return false
      emit([...options.value, byType.get(type)!.createDraft()])
      return true
    },
    updateMessage(id: string, patch: Partial<MessageDraft>) {
      emit(
        options.value.map((draft) =>
          draft.id === id ? ({ ...draft, ...patch } as MessageDraft) : draft,
        ),
      )
      return true
    },
    replaceMessage(id: string, nextDraft: MessageDraft) {
      emit(options.value.map((draft) => (draft.id === id ? nextDraft : draft)))
      return true
    },
    removeMessage(id: string) {
      emit(options.value.filter((draft) => draft.id !== id))
      return true
    },
    duplicateMessage(id: string) {
      const source = options.value.find((draft) => draft.id === id)
      if (
        !source ||
        (options.maxMessages !== undefined && options.value.length >= options.maxMessages)
      )
        return false
      const clone = { ...source, id: crypto.randomUUID() } as MessageDraft
      const index = options.value.findIndex((draft) => draft.id === id)
      emit([
        ...options.value.slice(0, index + 1),
        clone,
        ...options.value.slice(index + 1),
      ])
      return true
    },
    moveMessage(id: string, direction: 'up' | 'down') {
      const index = options.value.findIndex((draft) => draft.id === id)
      const target = direction === 'up' ? index - 1 : index + 1
      if (index < 0 || target < 0 || target >= options.value.length) return false
      const next = [...options.value]
      ;[next[index]!, next[target]!] = [next[target]!, next[index]!]
      emit(next)
      return true
    },
    attachQuickReply(id: string, quickReply: QuickReplyDraft) {
      return commands.updateMessage(id, { quickReply } as Partial<MessageDraft>)
    },
    clearQuickReply(id: string) {
      emit(
        options.value.map((draft) => {
          if (draft.id !== id) return draft
          const { quickReply, ...rest } = draft
          return rest as MessageDraft
        }),
      )
      return true
    },
  }

  return {
    value: options.value,
    extensions,
    commands,
    can: () => ({ insertMessage: canInsert }),
  }
}
