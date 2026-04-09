import { Image } from 'tamagui'
import type { LFexImage, LFexAction, LFexLayout } from '../types'
import { handleAction } from '../utils/action'
import { marginToTamagui } from '../utils/spacing'

export type LFexImageProps = LFexImage & {
  className?: string
  layout?: LFexLayout
  onAction?: (action: LFexAction) => void
}

export function LfImage({
  url,
  flex,
  margin,
  layout = 'vertical',
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
  const isHorizontalParent = layout === 'horizontal' || layout === 'baseline'

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

  const aspectRatioValue = aspectRatio
    ? (() => {
        const parts = aspectRatio.split(':')
        if (parts.length === 2) {
          const w = parseFloat(parts[0] ?? '1')
          const h = parseFloat(parts[1] ?? '1')
          return h > 0 ? w / h : undefined
        }
        return undefined
      })()
    : undefined

  const objectFit = aspectMode === 'cover' ? 'cover' : 'contain'

  // flex=undefined → no explicit flex (natural sizing)
  // flex=0 → flex-none
  // flex>=1 → fill available space
  const flexProps =
    flex === undefined
      ? {}
      : flex === 0
        ? { flexGrow: 0, flexShrink: 0, flexBasis: 'auto' }
        : { flex }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const imageProps: any = {
    ...flexProps,
    src: url,
    width,
    objectFit,
    ...positionStyle,
    ...offsetStyle,
    ...(backgroundColor && { background: backgroundColor }),
    ...(aspectRatioValue !== undefined && { aspectRatio: aspectRatioValue }),
    ...(action && { cursor: 'pointer' as const, onPress: clickHandler }),
    ...(className && { className }),
  }

  if (marginValue) {
    imageProps[isHorizontalParent ? 'marginLeft' : 'marginTop'] = marginValue
  }

  // @ts-ignore - Tamagui Image type incompatibilities
  return <Image {...imageProps} />
}
