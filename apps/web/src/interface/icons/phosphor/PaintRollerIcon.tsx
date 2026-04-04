import Svg, { Path } from 'react-native-svg'

import { useIconProps } from '~/interface/icons/useIconProps'

import type { IconProps } from '~/interface/icons/types'

export const PaintRollerIcon = (props: IconProps) => {
  const { width, height, fill, ...svgProps } = useIconProps(props)

  return (
    <Svg width={width} height={height} viewBox="0 0 256 256" fill="none" {...svgProps}>
      <Path
        d="M216,48H184V32a16,16,0,0,0-16-16H88A16,16,0,0,0,72,32V48H40A16,16,0,0,0,24,64V96a16,16,0,0,0,16,16H216a16,16,0,0,0,16-16V64A16,16,0,0,0,216,48ZM88,32h80V48H88ZM216,96H40V64H216V96ZM128,128a8,8,0,0,0-16,0v96H96a8,8,0,0,0,0,16h64a8,8,0,0,0,0-16H144V128A8,8,0,0,0,128,128Z"
        fill={fill}
      />
    </Svg>
  )
}
