import { useEffect, useRef } from 'react'
import { Animated } from 'react-native'
import { XStack } from 'tamagui'

function Dot({ delay }: { delay: number }) {
  const opacity = useRef(new Animated.Value(0.4)).current
  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(opacity, { toValue: 1, duration: 300, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.4, duration: 300, useNativeDriver: true }),
        Animated.delay(600 - delay),
      ]),
    )
    anim.start()
    return () => anim.stop()
  }, [opacity, delay])
  return (
    <Animated.View
      style={{
        opacity,
        width: 7,
        height: 7,
        borderRadius: 3.5,
        backgroundColor: 'white',
        marginHorizontal: 2,
      }}
    />
  )
}

export function TypingIndicator() {
  return (
    <XStack
      bg="$color8"
      px="$3"
      py="$2"
      items="center"
      style={{ borderRadius: 18, alignSelf: 'flex-start' }}
    >
      <Dot delay={0} />
      <Dot delay={200} />
      <Dot delay={400} />
    </XStack>
  )
}
