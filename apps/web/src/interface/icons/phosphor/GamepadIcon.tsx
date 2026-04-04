import Svg, { Path } from 'react-native-svg'

import { useIconProps } from '~/interface/icons/useIconProps'

import type { IconProps } from '~/interface/icons/types'

export const GamepadIcon = (props: IconProps) => {
  const { width, height, fill, ...svgProps } = useIconProps(props)

  return (
    <Svg width={width} height={height} viewBox="0 0 256 256" fill="none" {...svgProps}>
      <Path
        d="M216,64H40A24,24,0,0,0,16,88v80a24,24,0,0,0,24,24H216a24,24,0,0,0,24-24V88A24,24,0,0,0,216,64ZM64,144H48a8,8,0,0,1,0-16H64V112a8,8,0,0,1,16,0v16H96a8,8,0,0,1,0,16H80v16a8,8,0,0,1-16,0Zm128-16a16,16,0,1,1,16-16A16,16,0,0,1,192,128Zm32,0a16,16,0,1,1,16-16A16,16,0,0,1,224,128Z"
        fill={fill}
      />
    </Svg>
  )
}
