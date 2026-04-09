import { Image } from 'tamagui'
import type { LFexImage, LFexAction } from '../types'
import { handleAction } from '../utils/action'
import { marginToTamagui } from '../utils/spacing'

export type LFexImageProps = LFexImage & {
  className?: string
  onAction?: (action: LFexAction) => void
}

export function LfImage({
  url,
  flex,
  margin,
  position,
  offsetTop,
  offsetBottom,
  offsetStart,
  offsetEnd,
  align,
  gravity,
  size,
  aspectRatio,
  aspectMode = 'cover',
  backgroundColor,
  action,
  onAction,
  className,
}: LFexImageProps) {
  const marginValue = margin ? marginToTamagui(margin) : undefined

  const positionStyle = position === 'absolute' ? { position: 'absolute' as const } : {}
  const offsetStyle = {
    ...(offsetTop && { top: offsetTop }),
    ...(offsetBottom && { bottom: offsetBottom }),
    ...(offsetStart && { left: offsetStart }),
    ...(offsetEnd && { right: offsetEnd }),
  }

  const clickHandler = handleAction(action, onAction)

  const width =
    size === 'xxs'
      ? 26
      : size === 'xs'
        ? 34
        : size === 'sm'
          ? 42
          : size === 'md'
            ? 52
            : size === 'lg'
              ? 62
              : size === 'xl'
                ? 76
                : size === 'xxl'
                  ? 92
                  : size === '3xl'
                    ? 102
                    : size === '4xl'
                      ? 120
                      : size === '5xl'
                        ? 136
                        : size === 'full'
                          ? '100%'
                          : 52

  const aspectRatioStyle = aspectRatio
    ? { aspectRatio: aspectRatio.replace(':', ' / ') }
    : undefined

  const objectFit = aspectMode === 'cover' ? 'cover' : 'contain'

  const clickableProps = action
    ? { cursor: 'pointer' as const, onClick: clickHandler }
    : {}

  return (
    // @ts-ignore - TamaguiImage type incompatibility with JSX
    <Image
      {...(flex === undefined || flex === 0
        ? { style: { flexGrow: 0, flexShrink: 0, flexBasis: 'auto' } }
        : flex === 1
          ? { style: { flexGrow: 1, flexShrink: 0, flexBasis: 0 } }
          : { flex: flex ?? 1 })}
      width={width}
      source={{ uri: url }}
      objectFit={objectFit}
      {...positionStyle}
      {...offsetStyle}
      background={backgroundColor}
      {...aspectRatioStyle}
      {...clickableProps}
      className={className}
    />
  )
}
