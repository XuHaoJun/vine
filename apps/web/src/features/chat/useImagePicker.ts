import { useCallback } from 'react'

declare const __DEV__: boolean

export type PickedMedia = {
  uri: string
  name: string
  type: string
  kind: 'image' | 'video'
}

export function useImagePicker() {
  const pick = useCallback(async (): Promise<PickedMedia | null> => {
    if (__DEV__) {
      console.warn(
        '[useImagePicker] web should use the hidden <input> path, not this hook',
      )
    }
    return null
  }, [])
  return { pick }
}
