import { Link, Slot } from 'one'
import { SizableText, XStack, YStack } from 'tamagui'

export function CreatorShell() {
  return (
    <XStack flex={1} bg="$background">
      <YStack width={220} borderRightWidth={1} borderRightColor="$color4" p="$4" gap="$3">
        <SizableText size="$5" fontWeight="700">
          Vine Creator Studio
        </SizableText>
        <Link href={'/creator' as any}>
          <SizableText>概覽</SizableText>
        </Link>
        <Link href={'/creator/packages' as any}>
          <SizableText>我的作品</SizableText>
        </Link>
        <Link href={'/creator/sales' as any}>
          <SizableText>銷售報表</SizableText>
        </Link>
        <Link href={'/creator/packages/new' as any}>
          <SizableText>建立新貼圖組</SizableText>
        </Link>
      </YStack>
      <YStack flex={1} minW={0}>
        <Slot />
      </YStack>
    </XStack>
  )
}
