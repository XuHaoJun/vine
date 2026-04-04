import Svg, { Path } from 'react-native-svg'

import { useIconProps } from '~/interface/icons/useIconProps'

import type { IconProps } from '~/interface/icons/types'

export const UserPlusIcon = (props: IconProps) => {
  const { width, height, fill, ...svgProps } = useIconProps(props)

  return (
    <Svg width={width} height={height} viewBox="0 0 256 256" fill="none" {...svgProps}>
      <Path
        d="M152,104a48,48,0,1,0-48,48A48.05,48.05,0,0,0,152,104Zm-80,0a32,32,0,1,1,32,32A32,32,0,0,1,72,104Zm176,88a8,8,0,0,1-8,8H216v24a8,8,0,0,1-16,0V200H176a8,8,0,0,1,0-16h24V160a8,8,0,0,1,16,0v24h24A8,8,0,0,1,248,192ZM24,200a8,8,0,0,1,8-8H64.25a95.24,95.24,0,0,1,35.1-14.87A8,8,0,0,1,96,192.73a79.27,79.27,0,0,0-27.22,11.6A8,8,0,0,1,64.25,208H32A8,8,0,0,1,24,200Z"
        fill={fill}
      />
    </Svg>
  )
}
