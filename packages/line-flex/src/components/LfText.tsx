import { Text, Paragraph } from 'tamagui'
import { isWeb } from 'tamagui'
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

  const lineHeightValue = lineSpacing
    ? parseInt(lineSpacing.replace('px', '')) + 15
    : fontSize * 1.4

  const clickableProps = action
    ? { cursor: 'pointer' as const, onClick: clickHandler }
    : {}

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const textProps: any = {
    fontSize,
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
    ...(isWeb && {
      style: {
        lineHeight: `${lineHeightValue}px`,
        ...(maxLines && {
          display: '-webkit-box',
          WebkitLineClamp: maxLines,
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }),
        ...(flex === undefined || flex === 0
          ? { flexGrow: 0, flexShrink: 0, flexBasis: 'auto' }
          : flex === 1
            ? { flexGrow: 1, flexShrink: 0, flexBasis: 0 }
            : undefined),
      },
    }),
    ...(!isWeb && maxLines ? { numberOfLines: maxLines } : {}),
    ...(!isWeb && {
      ...(flex === undefined || flex === 0
        ? { flexGrow: 0, flexShrink: 0, flexBasis: 'auto' }
        : { flex }),
    }),
    ...clickableProps,
    className,
    ...positionStyle,
    ...offsetStyle,
  }

  return (
    <Paragraph {...textProps}>
      <Text {...textProps}>
        {text}
        {contents?.map((span: LFexSpan, i: number) => (
          <LfSpan key={i} {...span} />
        ))}
      </Text>
    </Paragraph>
  )
}
