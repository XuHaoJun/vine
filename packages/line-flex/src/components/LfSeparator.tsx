import { YStack, XStack } from 'tamagui'
import type { LFexSeparator } from '../types'
import { marginToTamagui } from '../utils/spacing'

export type LFexSeparatorProps = LFexSeparator & {
  layout?: 'horizontal' | 'vertical' | 'baseline'
}

export function LfSeparator({ margin, color, layout = 'vertical' }: LFexSeparatorProps) {
  const marginValue = margin ? marginToTamagui(margin) : undefined
  const isHorizontalParent = layout === 'horizontal' || layout === 'baseline'

  // Direction-aware margin: marginLeft for horizontal/baseline parent, marginTop for vertical
  const marginProps =
    marginValue !== undefined
      ? isHorizontalParent
        ? { marginLeft: marginValue }
        : { marginTop: marginValue }
      : {}

  const separatorColor = color ?? '#d4d6da'

  if (isHorizontalParent) {
    // Vertical separator line for horizontal boxes
    return (
      <YStack
        width={1}
        alignSelf="stretch"
        background={separatorColor}
        flexShrink={0}
        {...marginProps}
      />
    )
  }

  // Horizontal separator line for vertical boxes (default)
  return (
    <XStack
      height={1}
      alignSelf="stretch"
      background={separatorColor}
      flexShrink={0}
      {...marginProps}
    />
  )
}
