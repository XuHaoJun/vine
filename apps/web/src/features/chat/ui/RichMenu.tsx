import { memo } from 'react'
import { Pressable } from 'react-native'
import { YStack } from 'tamagui'
import { Image } from '~/interface/image/Image'

type RichMenuArea = {
  bounds: { x: number; y: number; width: number; height: number }
  action: {
    type: string
    label?: string
    uri?: string
    data?: string
    text?: string
  }
}

type Props = {
  imageUrl: string
  sizeWidth: number
  sizeHeight: number
  areas: RichMenuArea[]
  onAreaTap: (area: RichMenuArea) => void
}

export const RichMenu = memo(
  ({ imageUrl, sizeWidth, sizeHeight, areas, onAreaTap }: Props) => {
    const aspectRatio = sizeWidth / sizeHeight

    return (
      <YStack position="relative" width="100%" style={{ aspectRatio }}>
        <Image
          src={imageUrl}
          style={{
            width: '100%',
            height: '100%',
            resizeMode: 'contain',
          }}
        />
        {areas.map((area, index) => (
          <Pressable
            key={index}
            onPress={() => onAreaTap(area)}
            style={{
              position: 'absolute',
              left: `${(area.bounds.x / sizeWidth) * 100}%`,
              top: `${(area.bounds.y / sizeHeight) * 100}%`,
              width: `${(area.bounds.width / sizeWidth) * 100}%`,
              height: `${(area.bounds.height / sizeHeight) * 100}%`,
            }}
          />
        ))}
      </YStack>
    )
  },
)
