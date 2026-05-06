import { router } from 'one'
import { ScrollView, Text, XStack, YStack } from 'tamagui'

import { miniAppClient } from '~/features/mini-app/client'
import { useTanQuery } from '~/query'

function Card({
  m,
}: {
  m: { id: string; name: string; iconUrl?: string; category?: string }
}) {
  return (
    <YStack
      width={120}
      gap="$1"
      p="$2"
      rounded="$3"
      hoverStyle={{ bg: '$color3' }}
      cursor="pointer"
      onPress={() => router.push(`/m/${m.id}` as any)}
    >
      <YStack
        width={104}
        height={104}
        rounded="$3"
        items="center"
        justify="center"
        bg="$color3"
        overflow="hidden"
      >
        {m.iconUrl ? (
          <img src={m.iconUrl} width={104} height={104} alt={m.name} />
        ) : (
          <Text fontSize={32} color="$color10">
            📱
          </Text>
        )}
      </YStack>
      <Text fontWeight="600" numberOfLines={1} fontSize={13}>
        {m.name}
      </Text>
      {m.category && (
        <Text fontSize={11} color="$color10" numberOfLines={1}>
          {m.category}
        </Text>
      )}
    </YStack>
  )
}

export default function MiniAppsTab() {
  const gallery = useTanQuery({
    queryKey: ['miniApp', 'myGallery'],
    queryFn: () => miniAppClient.listMyGallery({}),
  })

  return (
    <YStack p="$3" gap="$4">
      <Text fontSize={24} fontWeight="700" color="$color12">
        Mini Apps
      </Text>

      <YStack gap="$2">
        <Text fontWeight="600" fontSize={16} color="$color12">
          Recents
        </Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <XStack gap="$2">
            {gallery.data?.recents.map((m) => (
              <Card key={m.id} m={m} />
            ))}
            {gallery.data?.recents.length === 0 && (
              <Text color="$color10">No recently used Mini Apps yet.</Text>
            )}
          </XStack>
        </ScrollView>
      </YStack>

      <YStack gap="$2">
        <Text fontWeight="600" fontSize={16} color="$color12">
          From your OAs
        </Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <XStack gap="$2">
            {gallery.data?.fromOas.map((m) => (
              <Card key={m.id} m={m} />
            ))}
            {gallery.data?.fromOas.length === 0 && (
              <Text color="$color10">No Mini Apps from OAs you follow yet.</Text>
            )}
          </XStack>
        </ScrollView>
      </YStack>

      <Text
        fontSize={14}
        color="$blue10"
        cursor="pointer"
        onPress={() => router.push('/mini-apps' as any)}
      >
        Explore the public directory →
      </Text>
    </YStack>
  )
}
