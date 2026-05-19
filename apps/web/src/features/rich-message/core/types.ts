import type { ComponentType, ReactNode } from 'react'

export type QuickReplyDraft = {
  items: Array<{ type: 'action'; action: Record<string, unknown> }>
}

export type BaseMessageDraft = {
  id: string
  quickReply?: QuickReplyDraft
}

export type TextMessageDraft = BaseMessageDraft & { type: 'text'; text: string }
export type ImageMessageDraft = BaseMessageDraft & {
  type: 'image'
  originalContentUrl: string
  previewImageUrl: string
}
export type VideoMessageDraft = BaseMessageDraft & {
  type: 'video'
  originalContentUrl: string
  previewImageUrl: string
}
export type AudioMessageDraft = BaseMessageDraft & {
  type: 'audio'
  originalContentUrl: string
  duration?: number
}
export type FlexMessageDraft = BaseMessageDraft & {
  type: 'flex'
  altText: string
  contents: unknown
}
export type ImagemapMessageDraft = BaseMessageDraft & {
  type: 'imagemap'
  altText: string
  baseUrl: string
  baseSize: { width: number; height: number }
  actions: unknown[]
}
export type UnknownMessageDraft = BaseMessageDraft & { type: string; raw: unknown }

export type MessageDraft =
  | TextMessageDraft
  | ImageMessageDraft
  | VideoMessageDraft
  | AudioMessageDraft
  | FlexMessageDraft
  | ImagemapMessageDraft
  | UnknownMessageDraft

export type ValidationResult = { ok: true } | { ok: false; message: string }

export type DraftEditorProps<TDraft extends MessageDraft> = {
  draft: TDraft
  update(next: TDraft): void
}

export type DraftPreviewProps<TDraft extends MessageDraft> = {
  draft: TDraft
  selected: boolean
  onSelect(): void
}

export type RichMessageExtension<TDraft extends MessageDraft = MessageDraft> = {
  type: TDraft['type']
  label: string
  icon: ComponentType<{ size?: number; color?: string }>
  group: 'basic' | 'media' | 'interactive' | 'disabled'
  status: 'enabled' | 'disabled'
  priority?: number
  createDraft(): TDraft
  validate(draft: TDraft): ValidationResult
  toMessagingApi(draft: TDraft): unknown
  fromMessagingApi(message: unknown): TDraft | null
  renderEditor(props: DraftEditorProps<TDraft>): ReactNode
  renderPreview(props: DraftPreviewProps<TDraft>): ReactNode
}
