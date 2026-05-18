import { SizableText } from 'tamagui'
import type {
  AudioMessageDraft,
  ImageMessageDraft,
  RichMessageExtension,
  VideoMessageDraft,
} from '../core/types'

function MediaIcon() {
  return <SizableText size="$2">M</SizableText>
}

function isHttpsUrl(value: string) {
  return value.startsWith('https://')
}

export function createImageUrlExtension(): RichMessageExtension<ImageMessageDraft> {
  return {
    type: 'image',
    label: 'Image',
    icon: MediaIcon,
    group: 'media',
    status: 'enabled',
    priority: 900,
    createDraft: () => ({
      id: crypto.randomUUID(),
      type: 'image',
      originalContentUrl: '',
      previewImageUrl: '',
    }),
    validate: (draft) =>
      isHttpsUrl(draft.originalContentUrl) && isHttpsUrl(draft.previewImageUrl)
        ? { ok: true }
        : {
            ok: false,
            message: 'Image message requires HTTPS original and preview URLs.',
          },
    toMessagingApi: (draft) => ({
      type: 'image',
      originalContentUrl: draft.originalContentUrl,
      previewImageUrl: draft.previewImageUrl,
      ...(draft.quickReply ? { quickReply: draft.quickReply } : {}),
    }),
    fromMessagingApi: () => null,
    renderEditor: () => null,
    renderPreview: () => null,
  }
}

export function createVideoUrlExtension(): RichMessageExtension<VideoMessageDraft> {
  return {
    ...createImageUrlExtension(),
    type: 'video',
    label: 'Video',
    createDraft: () => ({
      id: crypto.randomUUID(),
      type: 'video',
      originalContentUrl: '',
      previewImageUrl: '',
    }),
    validate: (draft) =>
      isHttpsUrl(draft.originalContentUrl) && isHttpsUrl(draft.previewImageUrl)
        ? { ok: true }
        : {
            ok: false,
            message: 'Video message requires HTTPS original and preview URLs.',
          },
    toMessagingApi: (draft) => ({
      type: 'video',
      originalContentUrl: draft.originalContentUrl,
      previewImageUrl: draft.previewImageUrl,
      ...(draft.quickReply ? { quickReply: draft.quickReply } : {}),
    }),
    fromMessagingApi: () => null,
    renderEditor: () => null,
    renderPreview: () => null,
  }
}

export function createAudioUrlExtension(): RichMessageExtension<AudioMessageDraft> {
  return {
    type: 'audio',
    label: 'Audio',
    icon: MediaIcon,
    group: 'media',
    status: 'enabled',
    priority: 880,
    createDraft: () => ({
      id: crypto.randomUUID(),
      type: 'audio',
      originalContentUrl: '',
    }),
    validate: (draft) =>
      isHttpsUrl(draft.originalContentUrl)
        ? { ok: true }
        : { ok: false, message: 'Audio message requires an HTTPS original URL.' },
    toMessagingApi: (draft) => ({
      type: 'audio',
      originalContentUrl: draft.originalContentUrl,
      ...(draft.duration ? { duration: draft.duration } : {}),
      ...(draft.quickReply ? { quickReply: draft.quickReply } : {}),
    }),
    fromMessagingApi: () => null,
    renderEditor: () => null,
    renderPreview: () => null,
  }
}
