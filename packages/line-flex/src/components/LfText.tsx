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
      ? 10
      : size === 'xs'
        ? 11
        : size === 'sm'
          ? 12
          : size === 'md'
            ? 14
            : size === 'lg'
              ? 16
              : size === 'xl'
                ? 18
                : size === 'xxl'
                  ? 20
                  : size === '3xl'
                    ? 24
                    : size === '4xl'
                      ? 30
                      : size === '5xl'
                        ? 36
                        : 14

  const textAlign = align === 'start' ? 'left' : align === 'end' ? 'right' : align

  const lineHeight: any = lineSpacing
    ? `${fontSize + parseInt(lineSpacing.replace('px', ''))}px`
    : undefined

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
    lineHeight,
    ...(isWeb && maxLines
      ? {
          style: {
            display: '-webkit-box',
            WebkitLineClamp: maxLines,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          },
        }
      : {}),
    ...(!isWeb && maxLines ? { numberOfLines: maxLines } : {}),
    ...clickableProps,
    className,
  }

  return (
    <Paragraph flex={flex ?? 1} {...positionStyle} {...offsetStyle}>
      <Text {...textProps}>
        {text}
        {contents?.map((span: LFexSpan, i: number) => (
          <LfSpan key={i} {...span} />
        ))}
      </Text>
    </Paragraph>
  )
}
