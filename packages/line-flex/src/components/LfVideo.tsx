import { Image } from 'tamagui'
import { handleAction } from '../utils/action'
import type { LFexVideo, LFexAction, LFexImage } from '../types'

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
        src={img.url}
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
      src={previewUrl}
      objectFit="cover"
      aspectRatio={aspectRatio.replace(':', ' / ')}
      onPress={clickHandler}
      className={className}
    />
  )
}
