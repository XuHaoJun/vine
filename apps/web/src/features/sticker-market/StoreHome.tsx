import { useState } from 'react'
import { router } from 'one'
import { ScrollView, SizableText, XStack, YStack } from 'tamagui'

import { useTanQuery } from '~/query'
import { Input } from '~/interface/forms/Input'
import { stickerMarketDiscoveryClient } from './client'

const TYPE_CHIPS = [
  { key: '', label: '全部' },
  { key: 'static', label: '靜態' },
]

function PackageCard({ pkg }: { pkg: { id: string; name: string; coverUrl: string; creatorDisplayName: string; priceMinor: number; currency: string; owned: boolean; stickerCount: number; displayPriceMinor: number; displayCurrency: string } }) {
  return (
    <YStack
      width={160}
      shrink={0}
      bg="$color2"
      rounded="$4"
      overflow="hidden"
      cursor="pointer"
      onPress={() => router.push(`/store/${pkg.id}` as any)}
      hoverStyle={{ bg: '$color3' }}
    >
      <YStack height={120} bg="$color3" overflow="hidden">
        <img
          src={pkg.coverUrl}
          alt={pkg.name}
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        />
      </YStack>
      <YStack p="$2" gap="$1">
        <SizableText size="$3" fontWeight="700" color="$color12" numberOfLines={1}>
          {pkg.name}
        </SizableText>
        <SizableText size="$2" color="$color10" numberOfLines={1}>
          {pkg.creatorDisplayName}
        </SizableText>
        <XStack items="center" gap="$1">
          {pkg.owned ? (
            <YStack bg="$green8" rounded="$2" px="$2" py="$1">
              <SizableText size="$2" color="white">已擁有</SizableText>
            </YStack>
          ) : (
            <SizableText size="$3" fontWeight="700" color="$color12">
              {pkg.displayCurrency}{pkg.displayPriceMinor ?? pkg.priceMinor}
            </SizableText>
          )}
        </XStack>
      </YStack>
    </YStack>
  )
}

function ShelfSection({ title, packages }: { title: string; packages: any[] }) {
  if (!packages || packages.length === 0) return null
  return (
    <YStack gap="$2">
      <SizableText size="$5" fontWeight="700" color="$color12">
        {title}
      </SizableText>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <XStack gap="$3" px="$4">
          {packages.map((pkg: any) => (
            <PackageCard key={pkg.id} pkg={pkg} />
          ))}
        </XStack>
      </ScrollView>
    </YStack>
  )
}

export function StoreHome() {
  const [searchQuery, setSearchQuery] = useState('')

  const { data, isLoading } = useTanQuery({
    queryKey: ['sticker-market', 'store-home'],
    queryFn: () => stickerMarketDiscoveryClient.getStoreHome({}),
  })

  const handleSearch = () => {
    const q = searchQuery.trim()
    router.push(`/store/search${q ? `?q=${encodeURIComponent(q)}` : ''}` as any)
  }

  return (
    <YStack flex={1} bg="$background">
      <XStack
        px="$4"
        py="$3"
        items="center"
        gap="$3"
        borderBottomWidth={1}
        borderBottomColor="$color4"
      >
        <SizableText size="$6" fontWeight="700" color="$color12">
          貼圖商店
        </SizableText>
      </XStack>

      <YStack px="$4" pt="$3" pb="$2" gap="$2">
        <Input
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="搜尋貼圖..."
          returnKeyType="search"
          onSubmitEditing={handleSearch}
        />
        <XStack gap="$2">
          {TYPE_CHIPS.map((chip) => (
            <YStack
              key={chip.key}
              bg="$color3"
              rounded="$4"
              px="$3"
              py="$1"
              cursor="pointer"
              hoverStyle={{ bg: '$color4' }}
              onPress={() => {
                const base = '/store/search'
                const params = new URLSearchParams()
                if (chip.key) params.set('type', chip.key)
                const qs = params.toString()
                router.push(qs ? `${base}?${qs}` : base as any)
              }}
            >
              <SizableText size="$3" color="$color12">
                {chip.label}
              </SizableText>
            </YStack>
          ))}
        </XStack>
      </YStack>

      <ScrollView flex={1}>
        <YStack gap="$4" pb="$6">
          {isLoading && (
            <SizableText size="$4" color="$color10" text="center" mt="$8">
              載入中...
            </SizableText>
          )}

          {!isLoading && data && (
            <YStack gap="$5" pt="$2">
              {data.featuredShelves?.map((shelf: any) => (
                <ShelfSection key={shelf.id} title={shelf.title} packages={shelf.packages} />
              ))}
              <ShelfSection title="7 日熱銷" packages={data.bestseller7d?.packages ?? []} />
              <ShelfSection title="30 日熱銷" packages={data.bestseller30d?.packages ?? []} />
              <ShelfSection title="最新發布" packages={data.latestReleases?.packages ?? []} />
            </YStack>
          )}

          {!isLoading && !data && (
            <SizableText size="$4" color="$color10" text="center" mt="$8">
              尚無貼圖套包
            </SizableText>
          )}
        </YStack>
      </ScrollView>
    </YStack>
  )
}
