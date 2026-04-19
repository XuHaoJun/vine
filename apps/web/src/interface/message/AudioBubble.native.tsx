import { memo, useEffect, useState } from 'react'
import { Pressable } from 'react-native'
import { SizableText, XStack } from 'tamagui'
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio'
import Svg, { Path } from 'react-native-svg'

type Props = {
  url: string
  duration?: number
  isMine: boolean
}

function formatDuration(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000))
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

export const AudioBubble = memo(({ url, duration, isMine }: Props) => {
  const player = useAudioPlayer(url)
  const status = useAudioPlayerStatus(player)
  const [playing, setPlaying] = useState(false)

  useEffect(() => {
    setPlaying(status.playing)
    if (status.didJustFinish) {
      player.seekTo(0)
      setPlaying(false)
    }
  }, [status.playing, status.didJustFinish, player])

  const toggle = () => {
    if (playing) player.pause()
    else player.play()
  }

  const elapsedMs = status.currentTime ? status.currentTime * 1000 : 0
  const display = playing ? elapsedMs : (duration ?? elapsedMs)
  const fg = isMine ? 'white' : '#333'

  return (
    <Pressable onPress={toggle}>
      <XStack
        items="center"
        gap="$2"
        px="$3"
        py="$2"
        minW={140}
        bg={isMine ? '#8be872' : 'white'}
        style={{ borderRadius: 18 }}
      >
        <Svg width={20} height={20} viewBox="0 0 24 24">
          {playing ? (
            <Path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" fill={fg} />
          ) : (
            <Path d="M8 5v14l11-7L8 5z" fill={fg} />
          )}
        </Svg>
        <SizableText fontSize={13} color={fg}>
          {formatDuration(display)}
        </SizableText>
      </XStack>
    </Pressable>
  )
})
