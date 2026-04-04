import Svg, { Path } from 'react-native-svg'

import { useIconProps } from '~/interface/icons/useIconProps'

import type { IconProps } from '~/interface/icons/types'

export const PlayIcon = (props: IconProps) => {
  const { width, height, fill, ...svgProps } = useIconProps(props)

  return (
    <Svg width={width} height={height} viewBox="0 0 256 256" fill="none" {...svgProps}>
      <Path
        d="M240,128a15.74,15.74,0,0,1-8.07,13.86L83.89,225.62a16,16,0,0,1-16.11.11A15.87,15.87,0,0,1,59.67,212L60,44a16,16,0,0,1,24.22-13.74L232.17,114A15.83,15.83,0,0,1,240,128Z"
        fill={fill}
      />
    </Svg>
  )
}
