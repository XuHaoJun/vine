import { Text } from 'tamagui'
import type { LFexSpan } from '../types'

export type LFexSpanProps = LFexSpan

export function LfSpan({ text, size, color, weight, style, decoration }: LFexSpanProps) {
  return (
    <Text
      fontSize={
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
      }
      color={color as any}
      fontWeight={weight === 'bold' ? '700' : '400'}
      fontStyle={style === 'italic' ? 'italic' : 'normal'}
      textDecorationLine={
        decoration === 'underline'
          ? 'underline'
          : decoration === 'line-through'
            ? 'line-through'
            : 'none'
      }
    >
      {text}
    </Text>
  )
}
