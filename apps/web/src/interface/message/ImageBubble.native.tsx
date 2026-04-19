import { memo, useState } from 'react'
import { Modal, Pressable } from 'react-native'
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

      <Modal
        visible={open}
        transparent
        animationType="fade"
        onRequestClose={() => setOpen(false)}
        statusBarTranslucent
      >
        <Pressable
          onPress={() => setOpen(false)}
          style={{
            flex: 1,
            backgroundColor: 'rgba(0,0,0,0.92)',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Image
            source={{ uri: url }}
            style={{ width: '95%', height: '95%' }}
            resizeMode="contain"
          />
        </Pressable>
      </Modal>
    </>
  )
})
