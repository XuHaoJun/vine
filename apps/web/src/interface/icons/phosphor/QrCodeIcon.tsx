import Svg, { Path } from 'react-native-svg'

import { useIconProps } from '~/interface/icons/useIconProps'

import type { IconProps } from '~/interface/icons/types'

export const QrCodeIcon = (props: IconProps) => {
  const { width, height, fill, ...svgProps } = useIconProps(props)

  return (
    <Svg width={width} height={height} viewBox="0 0 256 256" fill="none" {...svgProps}>
      <Path
        d="M48,160H32a16,16,0,0,0-16,16v48a16,16,0,0,0,16,16H80a16,16,0,0,0,16-16V176A16,16,0,0,0,80,160Zm0,64H32V176H80v48ZM48,176a8,8,0,1,0,8,8A8,8,0,0,0,48,176ZM176,16H128a16,16,0,0,0-16,16V80a16,16,0,0,0,16,16h48a16,16,0,0,0,16-16V32A16,16,0,0,0,176,16Zm0,64H128V32h48V80ZM176,32a8,8,0,1,0,8,8A8,8,0,0,0,176,32ZM80,16H32A16,16,0,0,0,16,32V80A16,16,0,0,0,32,96H80a16,16,0,0,0,16-16V32A16,16,0,0,0,80,16ZM80,80H32V32H80V80ZM48,32a8,8,0,1,0,8,8A8,8,0,0,0,48,32ZM176,160H128a16,16,0,0,0-16,16v48a16,16,0,0,0,16,16h48a16,16,0,0,0,16-16V176A16,16,0,0,0,176,160Zm0,64H128V176h48v48ZM176,176a8,8,0,1,0,8,8A8,8,0,0,0,176,176ZM144,112h16a8,8,0,0,0,0-16H144a8,8,0,0,0,0,16Zm48,0h16a8,8,0,0,0,0-16H192a8,8,0,0,0,0,16Zm-48,48h16a8,8,0,0,0,0-16H144a8,8,0,0,0,0,16Zm48,0h16a8,8,0,0,0,0-16H192a8,8,0,0,0,0,16Zm-96,0h16a8,8,0,0,0,0-16H112a8,8,0,0,0,0,16Z"
        fill={fill}
      />
    </Svg>
  )
}
