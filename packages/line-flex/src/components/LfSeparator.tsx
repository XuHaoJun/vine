import { YStack, XStack } from 'tamagui'
import type { LFexSeparator } from '../types'
import { mergeLineMarginWithParentSpacing } from '../utils/spacing'

export type LFexSeparatorProps = LFexSeparator & {
  layout?: 'horizontal' | 'vertical' | 'baseline'
  parentSpacing?: string
  childIndex?: number
}

export function LfSeparator({
  margin,
  color,
  layout = 'vertical',
  parentSpacing,
  childIndex,
}: LFexSeparatorProps) {
  const marginProps = mergeLineMarginWithParentSpacing(
    layout,
    childIndex,
    parentSpacing,
    'separator',
    margin,
  )
  const isHorizontalParent = layout === 'horizontal' || layout === 'baseline'

  const separatorColor = color ?? '#d4d6da'

  if (isHorizontalParent) {
    // Vertical separator line for horizontal boxes
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const props: any = {
      width: 1,
      alignSelf: 'stretch',
      background: separatorColor,
      flexShrink: 0,
      ...marginProps,
    }
    return <YStack {...props} />
  }

  // Horizontal separator line for vertical boxes (default)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const props: any = {
    height: 1,
    alignSelf: 'stretch',
    background: separatorColor,
    flexShrink: 0,
    ...marginProps,
  }
  return <XStack {...props} />
}
