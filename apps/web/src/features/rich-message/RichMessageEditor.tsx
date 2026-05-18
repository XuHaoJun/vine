import { useMemo, useState } from 'react'
import { SizableText, YStack } from 'tamagui'
import { createRichMessageEditor } from './core/editor'
import { FlexMessageDialog } from './dialogs/FlexMessageDialog'
import { MediaUrlDialog } from './dialogs/MediaUrlDialog'
import { RichMessagePreview } from './RichMessagePreview'
import { RichMessageStarterKit } from './RichMessageStarterKit'
import { RichMessageToolbar } from './RichMessageToolbar'
import type { MessageDraft, RichMessageExtension } from './core/types'

type Props = {
  value: MessageDraft[]
  onChange(next: MessageDraft[]): void
  extensions?: RichMessageExtension[]
  maxMessages?: number
  disabledTypes?: string[]
}

export function RichMessageEditor(props: Props) {
  const extensions = useMemo(
    () => props.extensions ?? RichMessageStarterKit.configure(),
    [props.extensions],
  )
  const [selectedDraftId, setSelectedDraftId] = useState<string | null>(null)
  const [dialogType, setDialogType] = useState<string | null>(null)
  const editor = createRichMessageEditor({
    value: props.value,
    onChange: props.onChange,
    extensions,
    maxMessages: props.maxMessages,
    disabledTypes: props.disabledTypes,
  })
  const selectedDraft = props.value.find((draft) => draft.id === selectedDraftId) ?? null
  const selectedExtension = selectedDraft
    ? editor.extensions.find((extension) => extension.type === selectedDraft.type)
    : null

  const insertFromToolbar = (type: string) => {
    if (type === 'image' || type === 'video' || type === 'audio' || type === 'flex') {
      setDialogType(type)
      return
    }
    const extension = editor.extensions.find((item) => item.type === type)
    if (!extension || !editor.can().insertMessage(type)) return
    const draft = extension.createDraft()
    props.onChange([...props.value, draft])
    setSelectedDraftId(draft.id)
  }

  const appendDraft = (draft: MessageDraft) => {
    props.onChange([...props.value, draft])
    setSelectedDraftId(draft.id)
  }

  const updateSelectedDraft = (next: MessageDraft) => {
    editor.commands.replaceMessage(next.id, next)
    setSelectedDraftId(next.id)
  }

  return (
    <YStack borderWidth={1} borderColor="$borderColor" rounded="$3" overflow="hidden">
      <RichMessagePreview drafts={props.value} onSelectDraft={setSelectedDraftId} />
      {selectedDraft && selectedExtension ? (
        <YStack p="$3" gap="$2" borderTopWidth={1} borderColor="$borderColor">
          <SizableText size="$2" fontWeight="700" color="$color10">
            Edit {selectedExtension.label}
          </SizableText>
          {selectedExtension.renderEditor({
            draft: selectedDraft as never,
            update: updateSelectedDraft as never,
          })}
        </YStack>
      ) : null}
      <RichMessageToolbar
        extensions={editor.extensions}
        canInsert={editor.can().insertMessage}
        insert={insertFromToolbar}
        count={props.value.length}
        maxMessages={props.maxMessages}
      />
      {dialogType === 'image' || dialogType === 'video' || dialogType === 'audio' ? (
        <MediaUrlDialog
          type={dialogType}
          onCancel={() => setDialogType(null)}
          onSave={(draft) => {
            appendDraft(draft)
            setDialogType(null)
          }}
        />
      ) : null}
      {dialogType === 'flex' ? (
        <FlexMessageDialog
          onCancel={() => setDialogType(null)}
          onSave={(draft) => {
            appendDraft(draft)
            setDialogType(null)
          }}
        />
      ) : null}
    </YStack>
  )
}
