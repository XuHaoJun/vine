import { Image } from 'tamagui'
import type { LFexIcon } from '../types'
import { marginToTamagui } from '../utils/spacing'

export type LFexIconProps = LFexIcon

export function LfIcon({
  url,
  size = 'md',
  aspectRatio = '1:1',
  margin,
  position,
  offsetTop,
  offsetBottom,
  offsetStart,
  offsetEnd,
}: LFexIconProps) {
  const marginValue = margin ? marginToTamagui(margin) : undefined

  const positionStyle = position === 'absolute' ? { position: 'absolute' as const } : {}
  const offsetStyle = {
    ...(offsetTop && { top: offsetTop }),
    ...(offsetBottom && { bottom: offsetBottom }),
    ...(offsetStart && { left: offsetStart }),
    ...(offsetEnd && { right: offsetEnd }),
  }

  const width =
    size === 'xxs'
      ? 14
      : size === 'xs'
        ? 16
        : size === 'sm'
          ? 20
          : size === 'md'
            ? 24
            : size === 'lg'
              ? 28
              : size === 'xl'
                ? 32
                : size === 'xxl'
                  ? 36
                  : size === '3xl'
                    ? 42
                    : size === '4xl'
                      ? 48
                      : size === '5xl'
                        ? 56
                        : 24

  return (
    // @ts-ignore - TamaguiImage type incompatibility with JSX
    <Image
      width={width}
      source={{ uri: url }}
      objectFit="contain"
      {...positionStyle}
      {...offsetStyle}
    />
  )
}
