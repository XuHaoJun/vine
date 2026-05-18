import { parseFlexMessageJson } from '../flex/flexMessageJson'
import type {
  AudioMessageDraft,
  FlexMessageDraft,
  ImageMessageDraft,
  VideoMessageDraft,
} from '../core/types'

type MediaInput =
  | { id: string; type: 'image'; originalContentUrl: string; previewImageUrl: string }
  | { id: string; type: 'video'; originalContentUrl: string; previewImageUrl: string }
  | { id: string; type: 'audio'; originalContentUrl: string; duration?: number }

export function buildMediaUrlDraft(
  input: MediaInput,
): ImageMessageDraft | VideoMessageDraft | AudioMessageDraft {
  if (input.type === 'audio') {
    return {
      id: input.id,
      type: 'audio',
      originalContentUrl: input.originalContentUrl,
      duration: input.duration,
    }
  }
  return {
    id: input.id,
    type: input.type,
    originalContentUrl: input.originalContentUrl,
    previewImageUrl: input.previewImageUrl,
  }
}

export function buildFlexDraftFromJson({
  id,
  json,
}: {
  id: string
  json: string
}): { ok: true; draft: FlexMessageDraft } | { ok: false; message: string } {
  const result = parseFlexMessageJson(json)
  if (!result.ok) return result
  return {
    ok: true,
    draft: {
      id,
      type: 'flex',
      altText: result.message.altText,
      contents: result.message.contents,
    },
  }
}
