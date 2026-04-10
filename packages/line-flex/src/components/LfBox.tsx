import { XStack, YStack } from 'tamagui'
import React from 'react'
import { Platform } from 'react-native'
import type { LFexBox, LFexComponent, LFexAction, LFexLayout } from '../types'
import type { LFexTextProps } from './LfText'
import type { LFexImageProps } from './LfImage'
import type { LFexButtonProps } from './LfButton'
import type { LFexIconProps } from './LfIcon'
import type { LFexSeparatorProps } from './LfSeparator'
import type { LFexSpacerProps } from './LfSpacer'
import type { LFexFillerProps } from './LfFiller'
import type { LFexVideoProps } from './LfVideo'
import { expandFlexForChild, getChildDefaultFlex, normalizeFlexValue } from '../utils/flex'
import {
  spacingToTamagui,
  marginToTamagui,
  paddingToTamagui,
  tamaguiSpaceTokenToPx,
} from '../utils/spacing'
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
  /** Parent flex direction; controls how numeric flex maps to basis (avoids 0-height rows in columns). */
  parentLayout?: LFexLayout
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
    case 'box': {
      // When a box has explicit width/height, those dimensions are fixed —
      // don't let the parent's default flex override them (e.g. flex:1 in a horizontal box).
      const hasExplicitDimensions = !!(child as any).width || !!(child as any).height
      const { parentLayout: _ignorePl, ...boxRest } = child as LFexBox & { parentLayout?: unknown }
      return (
        <LfBox
          key={key}
          {...boxRest}
          parentLayout={parentLayout}
          flex={hasExplicitDimensions ? 0 : effectiveFlex}
          onAction={onAction}
        />
      )
    }
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
      return <LfIcon key={key} {...child} layout={parentLayout} />
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
  parentLayout,
}: LFexBoxProps & { children?: React.ReactNode }) {
  const gap = spacing ? spacingToTamagui(spacing) : undefined
  const padding = paddingAll ? paddingToTamagui(paddingAll) : undefined
  const marginValue = margin ? marginToTamagui(margin) : undefined

  const hasAbsoluteChildren = contents.some((c) => (c as any).position === 'absolute')
  const positionStyle =
    position === 'absolute'
      ? { position: 'absolute' as const }
      : hasAbsoluteChildren
        ? { position: 'relative' as const }
        : {}
  const offsetStyle = {
    ...(offsetTop && { top: offsetTop }),
    ...(offsetBottom && { bottom: offsetBottom }),
    ...(offsetStart && { left: offsetStart }),
    ...(offsetEnd && { right: offsetEnd }),
  }

  const clickHandler = handleAction(action, onAction)

  const flexNum = normalizeFlexValue(flex)

  // Horizontal/baseline row that is a flex child of a vertical parent: passing flex* as Tamagui
  // props still compiles to atomic classes like _fb-0px (flex-basis 0) which wins over partial
  // inline style. Put the full flex triplet only in `style` and default alignItems so text height
  // is not stretch-collapsed when the row's used height is still resolving.
  const flexInColumnRow =
    (layout === 'horizontal' || layout === 'baseline') &&
    flexNum !== undefined &&
    flexNum !== 0 &&
    (parentLayout === 'vertical' || parentLayout === undefined)

  // flex=undefined → no explicit flex (natural sizing, safe for native vertical containers)
  // flex=0 → flex-none (0 0 auto)
  // flex>=1 → parent-aware basis (see expandFlexForChild), except flexInColumnRow (see style)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const flexProps: any =
    flexNum === undefined
      ? {}
      : flexNum === 0
        ? { flexGrow: 0, flexShrink: 0, flexBasis: 'auto' }
        : flexInColumnRow
          ? {}
          : expandFlexForChild(flexNum, parentLayout)

  const rowInColumnFlexStyle = flexInColumnRow
    ? ({
        flexGrow: flexNum,
        flexShrink: 1,
        flexBasis: 'auto',
        minHeight: 'min-content',
      } as const)
    : undefined

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
    ...(alignItems !== undefined
      ? { alignItems }
      : flexInColumnRow && layout === 'horizontal'
        ? { alignItems: 'flex-start' }
        : {}),
    ...(action && { cursor: 'pointer' as const }),
    ...(className && { className }),
    onClick: clickHandler,
    // overflow:hidden makes flex items' automatic min cross-size 0 (CSS flexbox), collapsing
    // nested text in horizontal rows / scroll areas. min-content restores intrinsic height.
    ...(height === undefined &&
      maxHeight === undefined && {
        '$platform-web': { minHeight: 'min-content' },
      }),
    ...(rowInColumnFlexStyle && { style: rowInColumnFlexStyle }),
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

  // Web: Tamagui styled XStack turns style.flex* into atomic classes (_grow-1 _fb-0px) that
  // still collapse row height. Plain div + inline CSS bypasses the compiler entirely.
  // vxrn / some bundles leave Platform.OS !== 'web' in the browser — also gate on document.
  const isWeb =
    Platform.OS === 'web' || (typeof document !== 'undefined' && typeof window !== 'undefined')

  if (layout === 'horizontal' && flexInColumnRow && isWeb) {
    const gapPx = tamaguiSpaceTokenToPx(gap)
    const paddingPx = tamaguiSpaceTokenToPx(padding)
    const marginTopPx = tamaguiSpaceTokenToPx(marginValue)

    const webStyle: React.CSSProperties = {
      display: 'flex',
      flexDirection: 'row',
      overflow: 'hidden',
      flex: `${flexNum} 1 auto`,
      minHeight: 'min-content',
      alignItems: alignItems ?? 'flex-start',
      ...(gapPx !== undefined && { gap: gapPx as number }),
      ...(paddingPx !== undefined && { padding: paddingPx as number }),
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
      ...(marginTopPx !== undefined && { marginTop: marginTopPx as number }),
      ...(action && { cursor: 'pointer' }),
    }

    return (
      <div style={webStyle} className={className} onClick={clickHandler}>
        {renderedContents}
      </div>
    )
  }

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

  return (
    <YStack overflow="hidden" {...containerProps}>
      {renderedContents}
    </YStack>
  )
}
