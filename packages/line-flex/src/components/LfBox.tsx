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
import {
  expandFlexForChild,
  getChildDefaultFlex,
  normalizeFlexValue,
} from '../utils/flex'
import {
  mergeLineMarginWithParentSpacing,
  paddingToTamagui,
  tamaguiSpaceTokenToPx,
} from '../utils/spacing'
import { handleAction } from '../utils/action'
import { lineBorderWidthToCssValue } from '../utils/border'
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
  /** Parent box `spacing` — applied as per-child margin (not CSS gap); see `mergeLineMarginWithParentSpacing`. */
  parentSpacing?: string
  /** Index of this box in the parent's `contents`. */
  childIndex?: number
}

function renderChild(
  child: LFexComponent,
  index: number,
  parentLayout: LFexLayout,
  onAction?: (action: LFexAction) => void,
  parentSpacing?: string,
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
      const { parentLayout: _ignorePl, ...boxRest } = child as LFexBox & {
        parentLayout?: unknown
      }
      return (
        <LfBox
          key={key}
          {...boxRest}
          parentLayout={parentLayout}
          parentSpacing={parentSpacing}
          childIndex={index}
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
          parentSpacing={parentSpacing}
          childIndex={index}
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
          parentSpacing={parentSpacing}
          childIndex={index}
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
          parentSpacing={parentSpacing}
          childIndex={index}
          onAction={onAction}
        />
      )
    case 'icon':
      return (
        <LfIcon
          key={key}
          {...child}
          layout={parentLayout}
          parentSpacing={parentSpacing}
          childIndex={index}
        />
      )
    case 'separator':
      return (
        <LfSeparator
          key={key}
          {...child}
          layout={parentLayout}
          parentSpacing={parentSpacing}
          childIndex={index}
        />
      )
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
  parentSpacing,
  childIndex,
}: LFexBoxProps & { children?: React.ReactNode }) {
  const padding = paddingAll ? paddingToTamagui(paddingAll) : undefined
  const mergedForBox = mergeLineMarginWithParentSpacing(
    parentLayout,
    childIndex,
    parentSpacing,
    'box',
    margin,
  )

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

  const borderWidthCss = lineBorderWidthToCssValue(borderWidth)

  const flexNum = normalizeFlexValue(flex)

  // Horizontal row that is a flex child of a vertical parent: passing flex* as Tamagui props
  // still compiles to atomic classes like _fb-0px (flex-basis 0) which wins over partial inline
  // style. Put the full flex triplet only in `style`. Align cross-axis with stretch so empty
  // boxes (e.g. 2px transit lines) fill row height; LfText uses alignSelf from gravity or flex-start.
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
    // react-line-flex lf-box: min-w-0 so LINE flex 1 0 0 rows share width across siblings
    minWidth: 0,
    ...(layout === 'horizontal' && parentLayout === 'vertical' ? { width: '100%' } : {}),
    padding,
    ...positionStyle,
    ...offsetStyle,
    ...(backgroundColor && { background: backgroundColor }),
    ...(borderColor && { borderColor }),
    ...(borderWidthCss && {
      borderWidth: borderWidthCss,
      borderStyle: 'solid' as const,
    }),
    ...(cornerRadius && { borderRadius: cornerRadius }),
    ...(width && { width, maxWidth: width }),
    ...(maxWidth && { maxWidth }),
    ...(height && { height }),
    ...(maxHeight && { maxHeight }),
    ...(justifyContent && { justifyContent }),
    ...(alignItems !== undefined
      ? { alignItems }
      : layout === 'horizontal'
        ? { alignItems: 'stretch' }
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

  if (mergedForBox.marginTop !== undefined) {
    containerProps.marginTop = mergedForBox.marginTop
  }
  if (mergedForBox.marginLeft !== undefined) {
    containerProps.marginLeft = mergedForBox.marginLeft
  }

  const renderedContents =
    contents.length > 0
      ? contents.map((child: LFexComponent, i: number) =>
          renderChild(child, i, layout, onAction, spacing),
        )
      : children

  // Web: Tamagui styled XStack turns style.flex* into atomic classes (_grow-1 _fb-0px) that
  // still collapse row height. Plain div + inline CSS bypasses the compiler entirely.
  // vxrn / some bundles leave Platform.OS !== 'web' in the browser — also gate on document.
  const isWeb =
    Platform.OS === 'web' ||
    (typeof document !== 'undefined' && typeof window !== 'undefined')

  if (layout === 'horizontal' && flexInColumnRow && isWeb) {
    const paddingPx = tamaguiSpaceTokenToPx(padding)
    const marginTopPx = tamaguiSpaceTokenToPx(mergedForBox.marginTop)
    const marginLeftPx = tamaguiSpaceTokenToPx(mergedForBox.marginLeft)

    const webStyle: React.CSSProperties = {
      display: 'flex',
      flexDirection: 'row',
      overflow: 'hidden',
      flex: `${flexNum} 1 auto`,
      minHeight: 'min-content',
      minWidth: 0,
      ...(parentLayout === 'vertical' ? { width: '100%' } : {}),
      alignItems: alignItems ?? 'stretch',
      ...(paddingPx !== undefined && { padding: paddingPx as number }),
      ...positionStyle,
      ...offsetStyle,
      ...(backgroundColor && { backgroundColor }),
      ...(borderColor && { borderColor }),
      ...(borderWidthCss && {
        borderWidth: borderWidthCss,
        borderStyle: 'solid',
      }),
      ...(cornerRadius && { borderRadius: cornerRadius }),
      ...(width && { width, maxWidth: width }),
      ...(maxWidth && { maxWidth }),
      ...(height && { height }),
      ...(maxHeight && { maxHeight }),
      ...(justifyContent && { justifyContent }),
      ...(marginTopPx !== undefined && { marginTop: marginTopPx as number }),
      ...(marginLeftPx !== undefined && { marginLeft: marginLeftPx as number }),
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
