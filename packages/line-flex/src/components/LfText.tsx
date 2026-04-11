import { Paragraph } from 'tamagui'
import React from 'react'
import type { LFexText, LFexSpan, LFexAction } from '../types'
import { expandFlexForChild, normalizeFlexValue } from '../utils/flex'
import { handleAction } from '../utils/action'
import { mergeLineMarginWithParentSpacing } from '../utils/spacing'
import { LfSpan } from './LfSpan'

export type LFexTextProps = LFexText & {
  className?: string
  layout?: 'horizontal' | 'vertical' | 'baseline'
  onAction?: (action: LFexAction) => void
  parentSpacing?: string
  childIndex?: number
}

export function LfText({
  text = '',
  contents,
  flex,
  margin,
  position,
  offsetTop,
  offsetBottom,
  offsetStart,
  offsetEnd,
  size = 'md',
  align,
  gravity,
  wrap = false,
  maxLines,
  weight,
  color,
  style,
  decoration,
  lineSpacing,
  action,
  layout,
  onAction,
  className,
  parentSpacing,
  childIndex,
}: LFexTextProps) {
  const isHorizontalParent = layout === 'horizontal' || layout === 'baseline'
  const marginProps = mergeLineMarginWithParentSpacing(
    layout,
    childIndex,
    parentSpacing,
    'text',
    margin,
  )

  const positionStyle = position === 'absolute' ? { position: 'absolute' as const } : {}
  const offsetStyle = {
    ...(offsetTop && { top: offsetTop }),
    ...(offsetBottom && { bottom: offsetBottom }),
    ...(offsetStart && { left: offsetStart }),
    ...(offsetEnd && { right: offsetEnd }),
  }

  const clickHandler = handleAction(action, onAction)

  const fontSize =
    size === 'xxs'
      ? 11
      : size === 'xs'
        ? 13
        : size === 'sm'
          ? 14
          : size === 'md'
            ? 16
            : size === 'lg'
              ? 19
              : size === 'xl'
                ? 22
                : size === 'xxl'
                  ? 29
                  : size === '3xl'
                    ? 35
                    : size === '4xl'
                      ? 48
                      : size === '5xl'
                        ? 74
                        : 16

  const textAlign = align === 'start' ? 'left' : align === 'end' ? 'right' : align

  // Absolute line height (number) — Tamagui adds px on web, passes as-is on native
  const lineHeightValue = lineSpacing
    ? parseInt(lineSpacing.replace('px', '')) + 15
    : fontSize * 1.4

  const flexNum = normalizeFlexValue(flex)

  // flex=undefined → no explicit flex (caller/renderChild provides the correct value)
  // flex=0 → flex-none
  // In a horizontal row, LINE uses flex 1 0 0 on children, but Tamagui emits flex-basis 0
  // (_fb-0px) which collapses text line-box height on web. Text uses basis auto + alignSelf.
  // Vertical parent: same basis rules as LfBox (expandFlexForChild).
  const crossAlignFromGravity: 'flex-start' | 'center' | 'flex-end' =
    gravity === 'center' ? 'center' : gravity === 'bottom' ? 'flex-end' : 'flex-start'

  const flexProps: any =
    flexNum === undefined
      ? {}
      : flexNum === 0
        ? {
            flexGrow: 0,
            flexShrink: 0,
            flexBasis: 'auto',
            ...(isHorizontalParent ? { alignSelf: crossAlignFromGravity } : {}),
          }
        : isHorizontalParent
          ? {
              // LINE horizontal flex is 1 0 0 — must match LfBox (basis 0), not basis:auto,
              // or each row sizes columns from min-content and the timeline column misaligns.
              ...expandFlexForChild(flexNum, 'horizontal'),
              ...(wrap ? { flexShrink: 1 } : {}),
              alignSelf: crossAlignFromGravity,
            }
          : expandFlexForChild(flexNum, layout ?? 'vertical')

  // numberOfLines: Tamagui handles web (webkit-box / ellipsis) and native (numberOfLines prop)
  const numberOfLines = maxLines || (!wrap ? 1 : undefined)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const paragraphProps: any = {
    ...flexProps,
    // Same as react-line-flex min-w-0 on .lf-box / text: lets flex-basis:0 distribute width
    ...(isHorizontalParent ? { minWidth: 0 } : {}),
    fontSize,
    lineHeight: lineHeightValue,
    color,
    fontWeight: weight === 'bold' ? '700' : '400',
    fontStyle: style === 'italic' ? 'italic' : 'normal',
    textDecorationLine:
      decoration === 'underline'
        ? 'underline'
        : decoration === 'line-through'
          ? 'line-through'
          : 'none',
    textAlign,
    // Reset browser default <p> margin
    margin: 0,
    ...positionStyle,
    ...offsetStyle,
    ...marginProps,
    ...(numberOfLines !== undefined && { numberOfLines }),
    ...(wrap && {
      whiteSpace: 'normal',
      wordWrap: 'break-word',
      overflowWrap: 'break-word',
    }),
    ...(action && { cursor: 'pointer' as const }),
    ...(className && { className }),
    onClick: clickHandler,
  }

  return (
    <Paragraph {...paragraphProps}>
      {text}
      {contents?.map((span: LFexSpan, i: number) => (
        <LfSpan key={i} {...span} />
      ))}
    </Paragraph>
  )
}
