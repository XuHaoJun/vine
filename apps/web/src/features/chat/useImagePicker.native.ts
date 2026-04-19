import { useCallback } from 'react'
import * as ImagePicker from 'expo-image-picker'
import { showToast } from '~/interface/toast/Toast'

export type PickedMedia = {
  uri: string
  name: string
  type: string
  kind: 'image' | 'video'
}

const VIDEO_EXT_RE = /\.(mp4|mov|m4v|webm)$/i

export function useImagePicker() {
  const pick = useCallback(async (): Promise<PickedMedia | null> => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (!perm.granted) {
      // canAskAgain === false means the OS will no longer show its own dialog
      // (user previously denied). Surface a toast so the tap doesn't appear dead.
      if (!perm.canAskAgain) {
        showToast('請在系統設定開啟相簿權限', { type: 'error' })
      }
      return null
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images', 'videos'],
      allowsMultipleSelection: false,
      quality: 0.85,
    })
    if (result.canceled || !result.assets[0]) return null

    const asset = result.assets[0]
    const uri = asset.uri
    const isVideo =
      asset.type === 'video' || (asset.fileName ? VIDEO_EXT_RE.test(asset.fileName) : false)
    const name = asset.fileName ?? (isVideo ? 'video.mp4' : 'image.jpg')
    const mimeType = asset.mimeType ?? (isVideo ? 'video/mp4' : 'image/jpeg')

    return { uri, name, type: mimeType, kind: isVideo ? 'video' : 'image' }
  }, [])

  return { pick }
}
