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

  // Compute effective flex based on parent layout direction:
  // - horizontal/baseline parent: undefined flex → 1 (fill remaining width)
  // - vertical parent: undefined flex → 'none' → pass undefined (natural sizing, safe on native)
  const defaultFlex = getChildDefaultFlex((child as any).flex, parentLayout)
  const effectiveFlex = defaultFlex === 'none' ? undefined : (defaultFlex as number)

  switch (child.type) {
    case 'box':
      // Override child's undefined flex with parent-layout default
      return <LfBox key={key} {...child} flex={effectiveFlex} onAction={onAction} />
    case 'text':
      // Pass both effectiveFlex and parentLayout (for direction-aware margin)
      return (
        <LfText
          key={key}
          {...child}
          flex={effectiveFlex}
          layout={parentLayout}
          onAction={onAction}
        />
      )
    case 'image':
      return (
        <LfImage
          key={key}
          {...child}
          flex={effectiveFlex}
          layout={parentLayout}
          onAction={onAction}
        />
      )
    case 'button':
      return (
        <LfButton
          key={key}
          {...child}
          flex={effectiveFlex}
          layout={parentLayout}
          onAction={onAction}
        />
      )
    case 'icon':
      return <LfIcon key={key} {...child} />
    case 'separator':
      return <LfSeparator key={key} {...child} layout={parentLayout} />
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

  // flex=undefined → no explicit flex (natural sizing, safe for native vertical containers)
  // flex=0 → flex-none (0 0 auto)
  // flex>=1 → Tamagui flex prop via expandStyle
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const flexProps: any =
    flex === undefined
      ? {}
      : flex === 0
        ? { flexGrow: 0, flexShrink: 0, flexBasis: 'auto' }
        : { flex }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const containerProps: any = {
    ...flexProps,
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

  // Boxes with margin are typically children of vertical boxes → marginTop only
  if (marginValue) {
    containerProps.marginTop = marginValue
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
