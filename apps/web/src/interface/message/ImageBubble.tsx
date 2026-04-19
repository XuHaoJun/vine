import { memo, useState } from 'react'
import { Pressable } from 'react-native'
import { YStack } from 'tamagui'
import { Image } from '~/interface/image/Image'

type Props = {
  url: string
  isMine: boolean
}

export const ImageBubble = memo(({ url }: Props) => {
  const [open, setOpen] = useState(false)

  return (
    <>
      <Pressable onPress={() => setOpen(true)}>
        <YStack maxW={280} style={{ borderRadius: 18, overflow: 'hidden' }}>
          <Image
            source={{ uri: url }}
            style={{ width: 280, height: 200 }}
            resizeMode="cover"
          />
        </YStack>
      </Pressable>

      {open && (
        <YStack
          $platform-web={{ position: 'fixed' as any }}
          position="absolute"
          t={0}
          l={0}
          r={0}
          b={0}
          bg="rgba(0,0,0,0.92)"
          items="center"
          justify="center"
          z={9999}
          onPress={() => setOpen(false)}
        >
          <Image
            source={{ uri: url }}
            style={{ width: '95%', height: '95%' }}
            resizeMode="contain"
          />
        </YStack>
      )}
    </>
  )
})
