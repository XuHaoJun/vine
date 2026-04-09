import { Button, Text } from 'tamagui'
import type { LFexButton, LFexAction } from '../types'
import { handleAction } from '../utils/action'
import { marginToTamagui } from '../utils/spacing'

export type LFexButtonProps = LFexButton & {
  className?: string
  onAction?: (action: LFexAction) => void
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
}: LFexButtonProps) {
  const marginValue = margin ? marginToTamagui(margin) : undefined

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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const buttonProps: any = {
    flex: flex ?? 1,
    height: heightValue,
    background: backgroundColor,
    ...positionStyle,
    ...offsetStyle,
  }

  if (marginValue) {
    buttonProps.margin = marginValue
  }

  return (
    <Button {...buttonProps} onPress={clickHandler} className={className}>
      <Text color={textColor as any} fontWeight="600" fontSize={textFontSize}>
        {action.label ?? 'Button'}
      </Text>
    </Button>
  )
}
