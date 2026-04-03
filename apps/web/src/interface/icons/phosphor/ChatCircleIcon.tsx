import Svg, { Path } from 'react-native-svg'

import { useIconProps } from '~/interface/icons/useIconProps'

import type { IconProps } from '~/interface/icons/types'

export const ChatCircleIcon = (props: IconProps) => {
  const { width, height, fill, ...svgProps } = useIconProps(props)

  return (
    <Svg width={width} height={height} viewBox="0 0 256 256" fill="none" {...svgProps}>
      <Path
        d="M140,180a12,12,0,1,1-12-12A12,12,0,0,1,140,180ZM84,168a12,12,0,1,0,12,12A12,12,0,0,0,84,168Zm44,0a12,12,0,1,0,12,12A12,12,0,0,0,128,168ZM227.42,144.83,192,109.25V72a64.07,64.07,0,0,0-64-64H64A64.07,64.07,0,0,0,0,72v64A64.07,64.07,0,0,0,64,200h16a95.83,95.83,0,0,0,56.83,18.58c1.14,0,2.29-.08,3.44-.18L176,247.76a16,16,0,0,0,22.63,0l32-32A15.89,15.89,0,0,0,240,204.42V167.58A15.88,15.88,0,0,0,227.42,144.83ZM224,200l-28.28-28.28a8,8,0,0,0-11.32,0L160,196.1V176a8,8,0,0,0-8-8H135.28l-22.63-22.63A8,8,0,0,0,101.32,140H80a8,8,0,0,0-8,8v32H64A48.06,48.06,0,0,1,16,132V68A48.06,48.06,0,0,1,64,20h64a48.06,48.06,0,0,1,48,48v44a8,8,0,0,0,2.34,5.66l37.66,37.66A8,8,0,0,1,224,161Z"
        fill={fill}
      />
    </Svg>
  )
}
