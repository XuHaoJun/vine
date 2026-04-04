import Svg, { Path } from 'react-native-svg'

import { useIconProps } from '~/interface/icons/useIconProps'

import type { IconProps } from '~/interface/icons/types'

export const SmileIcon = (props: IconProps) => {
  const { width, height, fill, ...svgProps } = useIconProps(props)

  return (
    <Svg width={width} height={height} viewBox="0 0 256 256" fill="none" {...svgProps}>
      <Path
        d="M128,24A104,104,0,1,0,232,128,104.11,104.11,0,0,0,128,24Zm0,192a88,88,0,1,1,88-88A88.1,88.1,0,0,1,128,216ZM96,112a12,12,0,1,1,12,12A12,12,0,0,1,96,112Zm80,0a12,12,0,1,1-12-12A12,12,0,0,1,176,112Zm21.9,34.8a8,8,0,0,1-2.6,11A64.35,64.35,0,0,1,128,176a64.35,64.35,0,0,1-67.3-18.2,8,8,0,0,1,12.8-9.6A48.29,48.29,0,0,0,128,160a48.29,48.29,0,0,0,54.5-11.8A8,8,0,0,1,197.9,146.8Z"
        fill={fill}
      />
    </Svg>
  )
}
