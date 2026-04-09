import { Image } from 'tamagui'
import type { LFexIcon, LFexLayout } from '../types'
import { marginToTamagui } from '../utils/spacing'

export type LFexIconProps = LFexIcon & {
  layout?: LFexLayout
}

export function LfIcon({
  url,
  size = 'md',
  aspectRatio = '1:1',
  margin,
  layout = 'baseline',
  position,
  offsetTop,
  offsetBottom,
  offsetStart,
  offsetEnd,
}: LFexIconProps) {
  const marginValue = margin ? marginToTamagui(margin) : undefined
  const isHorizontalParent = layout === 'horizontal' || layout === 'baseline'

  const positionStyle = position === 'absolute' ? { position: 'absolute' as const } : {}
  const offsetStyle = {
    ...(offsetTop && { top: offsetTop }),
    ...(offsetBottom && { bottom: offsetBottom }),
    ...(offsetStart && { left: offsetStart }),
    ...(offsetEnd && { right: offsetEnd }),
  }

  const baseSize =
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

  // aspectRatio "w:h" → compute width from height (baseSize is height)
  const aspectParts = aspectRatio.split(':')
  const aw = parseFloat(aspectParts[0] ?? '1')
  const ah = parseFloat(aspectParts[1] ?? '1')
  const width = ah > 0 ? Math.round((baseSize * aw) / ah) : baseSize

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const iconProps: any = {
    src: url,
    width,
    height: baseSize,
    objectFit: 'contain',
    flexShrink: 0,
    flexGrow: 0,
    flexBasis: 'auto',
    ...positionStyle,
    ...offsetStyle,
  }

  if (marginValue) {
    iconProps[isHorizontalParent ? 'marginLeft' : 'marginTop'] = marginValue
  }

  // @ts-ignore - Tamagui Image type incompatibilities
  return <Image {...iconProps} />
}
