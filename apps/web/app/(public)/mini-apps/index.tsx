import { useState } from 'react'
import { router } from 'one'
import { Button, Input, ScrollView, Stack, Text, XStack, YStack } from 'tamagui'

import { miniAppClient } from '~/features/mini-app/client'
import { useTanQuery } from '~/query'

export default function PublicDirectoryPage() {
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState<string | undefined>()
  const [offset, setOffset] = useState(0)

  const list = useTanQuery({
    queryKey: ['miniApp', 'listPublished', search, category, offset],
    queryFn: () =>
      miniAppClient.listPublished({
        searchQuery: search || undefined,
        category,
        limit: 50,
        offset,
      }),
  })

  const categories = ['reservation', 'queue', 'delivery', 'shopping', 'other']

  return (
    <YStack p="$4" gap="$3">
      <Text fontSize={28} fontWeight="700" color="$color12">
        Mini Apps
      </Text>

      <Input
        value={search}
        onChangeText={(s) => {
          setSearch(s)
          setOffset(0)
        }}
        placeholder="Search Mini Apps..."
      />

      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <XStack gap="$2">
          <Button
            theme={!category ? 'active' : undefined}
            size="$2"
            onPress={() => {
              setCategory(undefined)
              setOffset(0)
            }}
          >
            All
          </Button>
          {categories.map((c) => (
            <Button
              key={c}
              theme={category === c ? 'active' : undefined}
              size="$2"
              onPress={() => {
                setCategory(c)
                setOffset(0)
              }}
            >
              {c}
            </Button>
          ))}
        </XStack>
      </ScrollView>

      <YStack gap="$2">
        {list.data?.miniApps.map((m) => (
          <XStack
            key={m.id}
            p="$3"
            gap="$3"
            rounded="$3"
            hoverStyle={{ bg: '$color3' }}
            items="center"
            cursor="pointer"
            onPress={() => router.push(`/m/${m.id}` as any)}
          >
            <Stack
              w={56}
              h={56}
              rounded="$3"
              items="center"
              justify="center"
              bg="$color3"
              overflow="hidden"
            >
              {m.iconUrl ? (
                <img src={m.iconUrl} width={56} height={56} alt="" />
              ) : (
                <Text fontSize={24}>📱</Text>
              )}
            </Stack>
            <YStack flex={1}>
              <Text fontWeight="600" fontSize={16} color="$color12">
                {m.name}
              </Text>
              {m.description && (
                <Text fontSize={13} color="$color10" numberOfLines={1}>
                  {m.description}
                </Text>
              )}
              {m.category && (
                <Text fontSize={11} color="$color9">
                  {m.category}
                </Text>
              )}
            </YStack>
          </XStack>
        ))}
      </YStack>

      {list.data && list.data.total > offset + 50 && (
        <Button onPress={() => setOffset(offset + 50)}>Show more</Button>
      )}
    </YStack>
  )
}
