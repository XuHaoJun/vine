import { XStack, YStack } from 'tamagui'
import React from 'react'
import type { LFexBox, LFexComponent, LFexAction, LFexLayout } from '../types'
import { getChildDefaultFlex } from '../utils/flex'
import { spacingToTamagui, marginToTamagui, paddingToTamagui } from '../utils/spacing'
import { handleAction } from '../utils/action'
import { LfText, LFexTextProps } from './LfText'
import { LfImage, LFexImageProps } from './LfImage'
import { LfButton, LFexButtonProps } from './LfButton'

export type LFexBoxProps = LFexBox & {
  className?: string
  onAction?: (action: LFexAction) => void
}
const LfIcon = (props: any) => null
const LfSeparator = (props: any) => null
const LfSpacer = (props: any) => null
const LfFiller = (props: any) => null
const LfVideo = (props: any) => null

function renderChild(
  child: LFexComponent,
  index: number,
  parentLayout: LFexLayout,
  onAction?: (action: LFexAction) => void
): React.ReactNode {
  const key = `${child.type}-${index}`
  const defaultFlex = getChildDefaultFlex((child as any).flex, parentLayout)
  const childWithFlex = { ...child, flex: (child as any).flex ?? defaultFlex }

  switch (child.type) {
    case 'box':
      return <LfBox key={key} {...childWithFlex as LFexBoxProps} onAction={onAction} />
    case 'text':
      return <LfText key={key} {...childWithFlex as LFexTextProps} onAction={onAction} />
    case 'image':
      return <LfImage key={key} {...childWithFlex as LFexImageProps} onAction={onAction} />
    case 'button':
      return <LfButton key={key} {...childWithFlex as LFexButtonProps} onAction={onAction} />
    case 'icon':
      return <LfIcon key={key} {...childWithFlex} />
    case 'separator':
      return <LfSeparator key={key} {...childWithFlex} />
    case 'spacer':
      return <LfSpacer key={key} {...childWithFlex} />
    case 'filler':
      return <LfFiller key={key} {...childWithFlex} />
    case 'video':
      return <LfVideo key={key} {...childWithFlex} />
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

  const containerProps = {
    flex: flex ?? 1,
    gap,
    padding,
    margin: marginValue,
    ...positionStyle,
    ...offsetStyle,
    ...(backgroundColor && { backgroundColor }),
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

  const renderedContents = contents.length > 0
    ? contents.map((child: LFexComponent, i: number) => renderChild(child, i, layout, onAction))
    : children

  if (layout === 'horizontal') {
    return (
      <XStack {...containerProps}>
        {renderedContents}
      </XStack>
    )
  }

  if (layout === 'baseline') {
    return (
      <XStack alignItems="baseline" {...containerProps}>
        {renderedContents}
      </XStack>
    )
  }

  return (
    <YStack {...containerProps}>
      {renderedContents}
    </YStack>
  )
}
