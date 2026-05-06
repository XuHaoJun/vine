import { forwardRef } from 'react'
import {
  Switch as TamaguiSwitch,
  styled,
  type GetProps,
  type TamaguiElement,
} from 'tamagui'

const StyledSwitch = styled(TamaguiSwitch, {
  size: '$4',
})

export type SwitchProps = GetProps<typeof StyledSwitch>

export const Switch = forwardRef<TamaguiElement, SwitchProps>((props, ref) => {
  return <StyledSwitch ref={ref} {...props} />
})

Switch.displayName = 'Switch'
