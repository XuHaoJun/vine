import Svg, { Path } from 'react-native-svg'

import { useIconProps } from '~/interface/icons/useIconProps'

import type { IconProps } from '~/interface/icons/types'

export const MusicNoteIcon = (props: IconProps) => {
  const { width, height, fill, ...svgProps } = useIconProps(props)

  return (
    <Svg width={width} height={height} viewBox="0 0 256 256" fill="none" {...svgProps}>
      <Path
        d="M216,32H80A24,24,0,0,0,56,56V176a24,24,0,0,0,24,24,24,24,0,0,0,24-24V104h48v72a24,24,0,0,0,24,24,24,24,0,0,0,24-24V56h32a8,8,0,0,0,0-16Z"
        fill={fill}
      />
    </Svg>
  )
}
