import Svg, { Path } from 'react-native-svg'

import { useIconProps } from '~/interface/icons/useIconProps'

import type { IconProps } from '~/interface/icons/types'

export const BookmarkIcon = (props: IconProps) => {
  const { width, height, fill, ...svgProps } = useIconProps(props)

  return (
    <Svg width={width} height={height} viewBox="0 0 256 256" fill="none" {...svgProps}>
      <Path
        d="M224,48H32a8,8,0,0,0-8,8V208a16,16,0,0,0,16,16H56a16,16,0,0,0,16-16V160h112v48a16,16,0,0,0,16,16h24a16,16,0,0,0,16-16V56A8,8,0,0,0,224,48Z"
        fill={fill}
      />
    </Svg>
  )
}
