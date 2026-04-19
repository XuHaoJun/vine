import { memo, useEffect, useRef, useState } from 'react'
import { Pressable } from 'react-native'
import { SizableText, XStack } from 'tamagui'
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
  const [playing, setPlaying] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  useEffect(() => {
    const audio = new Audio(url)
    audioRef.current = audio
    const onEnded = () => {
      setPlaying(false)
      setElapsed(0)
    }
    const onTime = () => setElapsed(audio.currentTime * 1000)
    audio.addEventListener('ended', onEnded)
    audio.addEventListener('timeupdate', onTime)
    return () => {
      audio.removeEventListener('ended', onEnded)
      audio.removeEventListener('timeupdate', onTime)
      audio.pause()
      audio.src = ''
      audioRef.current = null
    }
  }, [url])

  const toggle = () => {
    const audio = audioRef.current
    if (!audio) return
    if (playing) audio.pause()
    else void audio.play()
    setPlaying(!playing)
  }

  const display = playing ? elapsed : (duration ?? elapsed)
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
