import { memo, useEffect } from 'react'
import { GestureDetector, Gesture } from 'react-native-gesture-handler'
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  runOnJS,
} from 'react-native-reanimated'
import { SizableText, YStack } from 'tamagui'

import type { Area, AreaBounds } from './types'

type Props = {
  area: Area
  label: string
  scaleFactor: number
  isSelected: boolean
  canvasHeightPx: number
  onSelect: (id: string) => void
  onUpdate: (id: string, bounds: AreaBounds) => void
  onDelete: (id: string) => void
}

export const AreaOverlay = memo(
  ({
    area,
    label,
    scaleFactor,
    isSelected,
    canvasHeightPx,
    onSelect,
    onUpdate,
    onDelete,
  }: Props) => {
    const { bounds } = area

    const tx = useSharedValue(bounds.x * scaleFactor)
    const ty = useSharedValue(bounds.y * scaleFactor)
    const tw = useSharedValue(bounds.w * scaleFactor)
    const th = useSharedValue(bounds.h * scaleFactor)

    useEffect(() => {
      tx.value = bounds.x * scaleFactor
      ty.value = bounds.y * scaleFactor
      tw.value = bounds.w * scaleFactor
      th.value = bounds.h * scaleFactor
    }, [bounds.x, bounds.y, bounds.w, bounds.h, scaleFactor, tx, ty, tw, th])

    const canvasW = 2500 * scaleFactor
    const canvasH = canvasHeightPx * scaleFactor

    const startX = useSharedValue(0)
    const startY = useSharedValue(0)
    const startW = useSharedValue(0)
    const startH = useSharedValue(0)

    function commitUpdate(nx: number, ny: number, nw: number, nh: number) {
      const cw = Math.max(20, Math.min(nw / scaleFactor, 2500))
      const ch = Math.max(20, Math.min(nh / scaleFactor, canvasHeightPx))
      const cx = Math.max(0, Math.min(nx / scaleFactor, 2500 - cw))
      const cy = Math.max(0, Math.min(ny / scaleFactor, canvasHeightPx - ch))
      onUpdate(area.id, {
        x: Math.round(cx),
        y: Math.round(cy),
        w: Math.round(cw),
        h: Math.round(ch),
      })
    }

    const tapGesture = Gesture.Tap().onEnd(() => {
      runOnJS(onSelect)(area.id)
    })

    const panGesture = Gesture.Pan()
      .minDistance(5)
      .onStart(() => {
        startX.value = tx.value
        startY.value = ty.value
      })
      .onUpdate((e) => {
        tx.value = Math.max(
          0,
          Math.min(startX.value + e.translationX, canvasW - tw.value),
        )
        ty.value = Math.max(
          0,
          Math.min(startY.value + e.translationY, canvasH - th.value),
        )
      })
      .onEnd(() => {
        runOnJS(commitUpdate)(tx.value, ty.value, tw.value, th.value)
      })

    const resizeGesture = Gesture.Pan()
      .onStart(() => {
        startW.value = tw.value
        startH.value = th.value
      })
      .onUpdate((e) => {
        tw.value = Math.max(
          20,
          Math.min(startW.value + e.translationX, canvasW - tx.value),
        )
        th.value = Math.max(
          20,
          Math.min(startH.value + e.translationY, canvasH - ty.value),
        )
      })
      .onEnd(() => {
        runOnJS(commitUpdate)(tx.value, ty.value, tw.value, th.value)
      })

    const bodyGesture = Gesture.Simultaneous(tapGesture, panGesture)

    const animStyle = useAnimatedStyle(() => ({
      position: 'absolute' as const,
      left: tx.value,
      top: ty.value,
      width: tw.value,
      height: th.value,
    }))

    const borderColor = isSelected ? '#ef4444' : '#3b82f6'
    const bg = isSelected ? 'rgba(239,68,68,0.12)' : 'rgba(59,130,246,0.1)'

    return (
      <GestureDetector gesture={bodyGesture}>
        <Animated.View
          style={[animStyle, { borderWidth: 2, borderColor, backgroundColor: bg }]}
        >
          <YStack
            position="absolute"
            t={2}
            r={2}
            width={16}
            height={16}
            rounded="$10"
            bg={borderColor}
            items="center"
            justify="center"
            onPress={() => onDelete(area.id)}
            cursor="pointer"
            z={10}
          >
            <SizableText size="$1" color="white" lineHeight={16}>
              ×
            </SizableText>
          </YStack>

          <YStack flex={1} items="center" justify="center">
            <SizableText size="$4" fontWeight="700" color={borderColor}>
              {label}
            </SizableText>
          </YStack>

          <GestureDetector gesture={resizeGesture}>
            <YStack
              position="absolute"
              b={0}
              r={0}
              width={12}
              height={12}
              bg={borderColor}
              cursor="se-resize"
            />
          </GestureDetector>
        </Animated.View>
      </GestureDetector>
    )
  },
)
