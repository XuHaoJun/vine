import { Image } from 'tamagui'
import type { LFexImage, LFexAction, LFexLayout } from '../types'
import { expandFlexForChild, normalizeFlexValue } from '../utils/flex'
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

  // Pixel widths aligned with learn-projects/react-line-flex `imageSizeVariants` (Tailwind v4 preview)
  const width =
    size === 'xxs'
      ? 40
      : size === 'xs'
        ? 60
        : size === 'sm'
          ? 80
          : size === 'md'
            ? 100
            : size === 'lg'
              ? 120
              : size === 'xl'
                ? 140
                : size === 'xxl'
                  ? 160
                  : size === '3xl'
                    ? 180
                    : size === '4xl'
                      ? 200
                      : size === '5xl'
                        ? 220
                        : size === 'full'
                          ? '100%'
                          : 100

  // size="full" with no aspectRatio: fill container height too (e.g. avatar in fixed-height box)
  const fillHeight = size === 'full' && !aspectRatio

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
  const flexNum = normalizeFlexValue(flex)

  const flexProps =
    flexNum === undefined
      ? {}
      : flexNum === 0
        ? { flexGrow: 0, flexShrink: 0, flexBasis: 'auto' }
        : expandFlexForChild(flexNum, layout)

  // react-line-flex lf-image: default cross-axis alignment is center (`items-center`) when align is omitted
  const alignSelf =
    align === 'start' ? 'flex-start' : align === 'end' ? 'flex-end' : 'center'

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const imageProps: any = {
    ...flexProps,
    alignSelf,
    maxWidth: size === 'full' ? undefined : '100%',
    src: url,
    width,
    ...(fillHeight && { height: '100%' }),
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
