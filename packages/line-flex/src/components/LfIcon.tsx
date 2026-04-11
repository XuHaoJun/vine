import { Image } from 'tamagui'
import type { LFexIcon, LFexLayout } from '../types'
import { mergeLineMarginWithParentSpacing } from '../utils/spacing'

export type LFexIconProps = LFexIcon & {
  layout?: LFexLayout
  parentSpacing?: string
  childIndex?: number
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
  parentSpacing,
  childIndex,
}: LFexIconProps) {
  const mergedMargin = mergeLineMarginWithParentSpacing(
    layout,
    childIndex,
    parentSpacing,
    'icon',
    margin,
  )

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

  if (mergedMargin.marginTop !== undefined) {
    iconProps.marginTop = mergedMargin.marginTop
  }
  if (mergedMargin.marginLeft !== undefined) {
    iconProps.marginLeft = mergedMargin.marginLeft
  }

  // @ts-ignore - Tamagui Image type incompatibilities
  return <Image {...iconProps} />
}
