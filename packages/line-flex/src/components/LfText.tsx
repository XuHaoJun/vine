import { Paragraph } from 'tamagui'
import React from 'react'
import type { LFexText, LFexSpan, LFexAction } from '../types'
import { handleAction } from '../utils/action'
import { marginToTamagui } from '../utils/spacing'
import { LfSpan } from './LfSpan'

export type LFexTextProps = LFexText & {
  className?: string
  layout?: 'horizontal' | 'vertical' | 'baseline'
  onAction?: (action: LFexAction) => void
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
}: LFexTextProps) {
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

  // flex=undefined → no explicit flex (caller/renderChild provides the correct value)
  // flex=0 → flex-none (0 0 auto), flex>=1 → Tamagui flex prop via expandStyle (N 1 0)
  const flexProps: any =
    flex === undefined
      ? {}
      : flex === 0
        ? { flexGrow: 0, flexShrink: 0, flexBasis: 'auto' }
        : { flex }

  // Direction-aware margin: marginLeft for horizontal/baseline parent, marginTop for vertical
  const marginProps =
    marginValue !== undefined
      ? isHorizontalParent
        ? { marginLeft: marginValue }
        : { marginTop: marginValue }
      : {}

  // numberOfLines: Tamagui handles web (webkit-box / ellipsis) and native (numberOfLines prop)
  const numberOfLines = maxLines || (!wrap ? 1 : undefined)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const paragraphProps: any = {
    ...flexProps,
    // min-width:0 prevents content from overflowing flex containers
    minWidth: 0,
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
