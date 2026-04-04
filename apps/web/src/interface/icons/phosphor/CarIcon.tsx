import Svg, { Path } from 'react-native-svg'

import { useIconProps } from '~/interface/icons/useIconProps'

import type { IconProps } from '~/interface/icons/types'

export const CarIcon = (props: IconProps) => {
  const { width, height, fill, ...svgProps } = useIconProps(props)

  return (
    <Svg width={width} height={height} viewBox="0 0 256 256" fill="none" {...svgProps}>
      <Path
        d="M223.13,112.87l-20-32A15.89,15.89,0,0,0,189.59,72H144V48a16,16,0,0,0-16-16H128A16,16,0,0,0,112,48V72H66.41a15.89,15.89,0,0,0-13.54,8.87l-20,32A15.9,15.9,0,0,0,32,128v40a16,16,0,0,0,16,16h8a24,24,0,0,0,46.62,8h62.76A24,24,0,0,0,192,208h8a16,16,0,0,0,16-16V128A15.9,15.9,0,0,0,223.13,112.87ZM128,48V72h0V48ZM72,192a8,8,0,1,1,8-8A8,8,0,0,1,72,192Zm112,0a8,8,0,1,1,8-8A8,8,0,0,1,184,192Zm16-24H56V128H200v40ZM189.59,88,200,104H56L66.41,88Z"
        fill={fill}
      />
    </Svg>
  )
}
