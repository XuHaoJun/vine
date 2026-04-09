import { XStack, YStack } from 'tamagui'
import React from 'react'
import type { LFexBox, LFexComponent, LFexAction, LFexLayout } from '../types'
import type { LFexTextProps } from './LfText'
import type { LFexImageProps } from './LfImage'
import type { LFexButtonProps } from './LfButton'
import type { LFexIconProps } from './LfIcon'
import type { LFexSeparatorProps } from './LfSeparator'
import type { LFexSpacerProps } from './LfSpacer'
import type { LFexFillerProps } from './LfFiller'
import type { LFexVideoProps } from './LfVideo'
import { getChildDefaultFlex } from '../utils/flex'
import { spacingToTamagui, marginToTamagui, paddingToTamagui } from '../utils/spacing'
import { handleAction } from '../utils/action'
import { LfText } from './LfText'
import { LfImage } from './LfImage'
import { LfButton } from './LfButton'
import { LfIcon } from './LfIcon'
import { LfSeparator } from './LfSeparator'
import { LfSpacer } from './LfSpacer'
import { LfFiller } from './LfFiller'
import { LfVideo } from './LfVideo'

export type LFexBoxProps = LFexBox & {
  className?: string
  onAction?: (action: LFexAction) => void
}

function renderChild(
  child: LFexComponent,
  index: number,
  parentLayout: LFexLayout,
  onAction?: (action: LFexAction) => void,
): React.ReactNode {
  const key = `${child.type}-${index}`
  const defaultFlex = getChildDefaultFlex((child as any).flex, parentLayout)
  const childFlex = (child as any).flex ?? defaultFlex

  switch (child.type) {
    case 'box':
      return <LfBox key={key} {...child} onAction={onAction} />
    case 'text':
      return <LfText key={key} {...child} onAction={onAction} />
    case 'image':
      return <LfImage key={key} {...child} onAction={onAction} />
    case 'button':
      return <LfButton key={key} {...child} onAction={onAction} />
    case 'icon':
      return <LfIcon key={key} {...child} />
    case 'separator':
      return <LfSeparator key={key} {...child} />
    case 'spacer':
      return <LfSpacer key={key} {...child} />
    case 'filler':
      return <LfFiller key={key} {...child} />
    case 'video':
      return <LfVideo key={key} {...child} />
    default:
      return null
  }
}

export function LfBox({
  layout = 'vertical',
  contents = [],
  flex,
  spacing,
  margin,
  paddingAll,
  paddingTop,
  paddingBottom,
  paddingStart,
  paddingEnd,
  position,
  offsetTop,
  offsetBottom,
  offsetStart,
  offsetEnd,
  backgroundColor,
  borderColor,
  borderWidth,
  cornerRadius,
  width,
  maxWidth,
  height,
  maxHeight,
  justifyContent,
  alignItems,
  background,
  action,
  onAction,
  className,
  children,
}: LFexBoxProps & { children?: React.ReactNode }) {
  const gap = spacing ? spacingToTamagui(spacing) : undefined
  const padding = paddingAll ? paddingToTamagui(paddingAll) : undefined
  const marginValue = margin ? marginToTamagui(margin) : undefined

  const positionStyle = position === 'absolute' ? { position: 'absolute' as const } : {}
  const offsetStyle = {
    ...(offsetTop && { top: offsetTop }),
    ...(offsetBottom && { bottom: offsetBottom }),
    ...(offsetStart && { left: offsetStart }),
    ...(offsetEnd && { right: offsetEnd }),
  }

  const clickHandler = handleAction(action, onAction)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const containerProps: any = {
    ...(flex === undefined || flex === 0
      ? { style: { flexGrow: 0, flexShrink: 0, flexBasis: 'auto' } }
      : flex === 1
        ? { style: { flexGrow: 1, flexShrink: 0, flexBasis: 0 } }
        : { flex }),
    gap,
    padding,
    ...positionStyle,
    ...offsetStyle,
    ...(backgroundColor && { background: backgroundColor }),
    ...(borderColor && { borderColor }),
    ...(cornerRadius && { borderRadius: cornerRadius }),
    ...(width && { width }),
    ...(maxWidth && { maxWidth }),
    ...(height && { height }),
    ...(maxHeight && { maxHeight }),
    ...(justifyContent && { justifyContent }),
    ...(alignItems && { alignItems }),
    ...(action && { cursor: 'pointer' as const }),
    ...(className && { className }),
    onClick: clickHandler,
  }

  if (marginValue) {
    containerProps.margin = marginValue
  }

  const renderedContents =
    contents.length > 0
      ? contents.map((child: LFexComponent, i: number) =>
          renderChild(child, i, layout, onAction),
        )
      : children

  if (layout === 'horizontal') {
    return (
      <XStack overflow="hidden" {...containerProps}>
        {renderedContents}
      </XStack>
    )
  }

  if (layout === 'baseline') {
    return (
      <XStack alignItems="baseline" overflow="hidden" {...containerProps}>
        {renderedContents}
      </XStack>
    )
  }

  return <YStack {...containerProps}>{renderedContents}</YStack>
}
