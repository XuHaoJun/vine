import { Image } from 'tamagui'
import type { LFexVideo, LFexAction, LFexImage } from '../types'
import { handleAction } from '../utils/action'

export type LFexVideoProps = LFexVideo & {
  className?: string
  onAction?: (action: LFexAction) => void
}

export function LfVideo({
  url,
  previewUrl,
  altContent,
  aspectRatio = '20:13',
  action,
  onAction,
  className,
}: LFexVideoProps) {
  const clickHandler = handleAction(action, onAction)

  if (altContent?.type === 'image') {
    const img = altContent as LFexImage
    return (
      // @ts-ignore - TamaguiImage type incompatibility with JSX
      <Image
        flex={1}
        source={{ uri: img.url }}
        objectFit="cover"
        aspectRatio={aspectRatio.replace(':', ' / ')}
        onPress={clickHandler}
        className={className}
      />
    )
  }

  return (
    // @ts-ignore - TamaguiImage type incompatibility with JSX
    <Image
      flex={1}
      source={{ uri: previewUrl }}
      objectFit="cover"
      aspectRatio={aspectRatio.replace(':', ' / ')}
      onPress={clickHandler}
      className={className}
    />
  )
}
