import { Button, Text } from 'tamagui'
import type { LFexButton, LFexAction, LFexLayout } from '../types'
import { expandFlexForChild, normalizeFlexValue } from '../utils/flex'
import { handleAction } from '../utils/action'
import { mergeLineMarginWithParentSpacing } from '../utils/spacing'

export type LFexButtonProps = LFexButton & {
  className?: string
  layout?: LFexLayout
  onAction?: (action: LFexAction) => void
  parentSpacing?: string
  childIndex?: number
}

const LINE_BUTTON_COLORS = {
  primary: '#17c950',
  secondary: '#dcdfe5',
  link: '#42659a',
} as const

export function LfButton({
  action,
  flex,
  margin,
  layout = 'vertical',
  position,
  offsetTop,
  offsetBottom,
  offsetStart,
  offsetEnd,
  height = 'md',
  style = 'link',
  color,
  onAction,
  className,
  parentSpacing,
  childIndex,
}: LFexButtonProps) {
  const mergedMargin = mergeLineMarginWithParentSpacing(
    layout,
    childIndex,
    parentSpacing,
    'button',
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

  const heightValue = height === 'sm' ? 40 : 52

  const textFontSize = height === 'sm' ? 13 : 14

  const backgroundColor =
    color ??
    (style === 'primary'
      ? LINE_BUTTON_COLORS.primary
      : style === 'secondary'
        ? LINE_BUTTON_COLORS.secondary
        : 'transparent')

  const textColor =
    style === 'primary'
      ? '#ffffff'
      : style === 'secondary'
        ? '#111111'
        : (color ?? LINE_BUTTON_COLORS.link)

  // flex=undefined → no explicit flex (natural sizing)
  // flex=0 → flex-none
  // flex>=1 → fill available space
  const flexNum = normalizeFlexValue(flex)

  const flexProps =
    flexNum === undefined
      ? {}
      : flexNum === 0
        ? { flexGrow: 0, flexShrink: 0, flexBasis: 'auto' }
        : expandFlexForChild(flexNum, layout)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const buttonProps: any = {
    ...flexProps,
    height: heightValue,
    background: backgroundColor,
    ...positionStyle,
    ...offsetStyle,
  }

  if (mergedMargin.marginTop !== undefined) {
    buttonProps.marginTop = mergedMargin.marginTop
  }
  if (mergedMargin.marginLeft !== undefined) {
    buttonProps.marginLeft = mergedMargin.marginLeft
  }

  return (
    <Button {...buttonProps} onPress={clickHandler} className={className}>
      <Text color={textColor as any} fontWeight="600" fontSize={textFontSize}>
        {action.label ?? 'Button'}
      </Text>
    </Button>
  )
}
