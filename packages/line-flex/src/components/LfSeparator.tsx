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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const props: any = { width: 1, alignSelf: 'stretch', background: separatorColor, flexShrink: 0, ...marginProps }
    return <YStack {...props} />
  }

  // Horizontal separator line for vertical boxes (default)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const props: any = { height: 1, alignSelf: 'stretch', background: separatorColor, flexShrink: 0, ...marginProps }
  return <XStack {...props} />
}
