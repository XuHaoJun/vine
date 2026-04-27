import { useState, useMemo, useEffect } from 'react'
import { router } from 'one'
import { ScrollView, SizableText, XStack, YStack } from 'tamagui'

import { useAuth } from '~/features/auth/client/authClient'
import { allStickerPackages } from '@vine/zero-schema/queries/stickerPackage'
import { entitlementsByUserId } from '@vine/zero-schema/queries/entitlement'
import { useZeroQuery } from '~/zero/client'
import { Input } from '~/interface/forms/Input'
import { Button } from '~/interface/buttons/Button'
import { useTanQuery } from '~/query'
import { stickerMarketDiscoveryClient } from './client'

type Props = {
  onSelect: (packageId: string, stickerId: number) => void
}

type Tab = 'owned' | 'discovery'

export function StickerPicker({ onSelect }: Props) {
  const { user } = useAuth()
  const userId = user?.id ?? ''
  const [tab, setTab] = useState<Tab>('owned')
  const [selectedPackageId, setSelectedPackageId] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')

  const [packages] = useZeroQuery(allStickerPackages, {})
  const [entitlements] = useZeroQuery(
    entitlementsByUserId,
    { userId },
    { enabled: Boolean(userId) },
  )

  const ownedIds = useMemo(
    () => new Set((entitlements ?? []).map((e) => e.packageId)),
    [entitlements],
  )
  const ownedPackages = useMemo(
    () => (packages ?? []).filter((p) => ownedIds.has(p.id)),
    [packages, ownedIds],
  )

  const filteredOwned = useMemo(
    () =>
      searchQuery
        ? ownedPackages.filter((p) =>
            p.name.toLowerCase().includes(searchQuery.toLowerCase()),
          )
        : ownedPackages,
    [ownedPackages, searchQuery],
  )

  const { data: storeHomeData } = useTanQuery({
    queryKey: ['sticker-market', 'store-home'],
    queryFn: () => stickerMarketDiscoveryClient.getStoreHome({}),
  })

  const discoveryPackages = useMemo(() => {
    const seen = new Set(ownedIds)
    const result: any[] = []
    if (storeHomeData?.bestseller7d?.packages) {
      for (const p of storeHomeData.bestseller7d.packages) {
        if (!seen.has(p.id)) {
          result.push(p)
          seen.add(p.id)
        }
      }
    }
    if (storeHomeData?.latestReleases?.packages) {
      for (const p of storeHomeData.latestReleases.packages) {
        if (!seen.has(p.id)) result.push(p)
      }
    }
    if (storeHomeData?.featuredShelves) {
      for (const shelf of storeHomeData.featuredShelves) {
        for (const p of shelf.packages) {
          if (!seen.has(p.id)) result.push(p)
        }
      }
    }
    return result
  }, [storeHomeData, ownedIds])

  const activePackage =
    filteredOwned.find((p) => p.id === selectedPackageId) ?? filteredOwned[0] ?? null

  useEffect(() => {
    if (ownedPackages.length === 0 && tab === 'owned') {
      setTab('discovery')
    }
  }, [ownedPackages.length, tab])

  if (
    tab === 'discovery' &&
    ownedPackages.length === 0 &&
    discoveryPackages.length === 0
  ) {
    return (
      <YStack height={180} items="center" justify="center" bg="$background" gap="$3">
        <SizableText size="$3" color="$color10">
          還沒有貼圖，前往貼圖商店購買！
        </SizableText>
        <Button size="$3" onPress={() => router.push('/store' as any)}>
          前往商店
        </Button>
      </YStack>
    )
  }

  const stickerCount = activePackage?.stickerCount ?? 0

  return (
    <YStack height={280} bg="$background" borderTopWidth={1} borderTopColor="$color4">
      {/* Tabs */}
      <XStack borderBottomWidth={1} borderBottomColor="$color4">
        <YStack
          flex={1}
          items="center"
          py="$2"
          borderBottomWidth={2}
          borderBottomColor={tab === 'owned' ? '$color12' : 'transparent'}
          cursor="pointer"
          onPress={() => setTab('owned')}
        >
          <SizableText
            size="$3"
            fontWeight={tab === 'owned' ? '700' : '400'}
            color="$color12"
          >
            我的貼圖
          </SizableText>
        </YStack>
        <YStack
          flex={1}
          items="center"
          py="$2"
          borderBottomWidth={2}
          borderBottomColor={tab === 'discovery' ? '$color12' : 'transparent'}
          cursor="pointer"
          onPress={() => setTab('discovery')}
        >
          <SizableText
            size="$3"
            fontWeight={tab === 'discovery' ? '700' : '400'}
            color="$color12"
          >
            發現
          </SizableText>
        </YStack>
      </XStack>

      {tab === 'owned' && (
        <>
          <XStack px="$2" py="$1.5" borderBottomWidth={1} borderBottomColor="$color4">
            <Input
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="搜尋貼圖..."
              size="$2"
            />
          </XStack>
          {filteredOwned.length > 0 && (
            <XStack borderBottomWidth={1} borderBottomColor="$color4">
              {filteredOwned.map((pkg) => (
                <YStack
                  key={pkg.id}
                  onPress={() => setSelectedPackageId(pkg.id)}
                  px="$2"
                  py="$1.5"
                  borderBottomWidth={2}
                  borderBottomColor={
                    activePackage?.id === pkg.id ? '$color12' : 'transparent'
                  }
                  cursor="pointer"
                >
                  <img
                    src={`/uploads/${pkg.tabIconDriveKey}`}
                    width={32}
                    height={32}
                    alt={pkg.name}
                    style={{ objectFit: 'contain' }}
                  />
                </YStack>
              ))}
            </XStack>
          )}
          {filteredOwned.length === 0 && (
            <YStack flex={1} items="center" justify="center">
              <SizableText size="$3" color="$color10">
                {searchQuery ? '找不到符合的貼圖' : '還沒有貼圖'}
              </SizableText>
            </YStack>
          )}
          {activePackage && (
            <ScrollView flex={1}>
              <XStack flexWrap="wrap" p="$2" gap="$1">
                {Array.from({ length: stickerCount }, (_, i) => i + 1).map(
                  (stickerId) => (
                    <YStack
                      key={stickerId}
                      onPress={() =>
                        activePackage && onSelect(activePackage.id, stickerId)
                      }
                      width={64}
                      height={64}
                      rounded="$3"
                      items="center"
                      justify="center"
                      cursor="pointer"
                      hoverStyle={{ bg: '$color3' }}
                    >
                      <img
                        src={`/uploads/stickers/${activePackage.id}/${stickerId}.png`}
                        width={52}
                        height={52}
                        alt={`sticker ${stickerId}`}
                        style={{ objectFit: 'contain' }}
                      />
                    </YStack>
                  ),
                )}
              </XStack>
            </ScrollView>
          )}
        </>
      )}

      {tab === 'discovery' && (
        <ScrollView flex={1}>
          {discoveryPackages.length === 0 && (
            <YStack flex={1} items="center" justify="center" py="$8">
              <SizableText size="$3" color="$color10">
                探索更多貼圖！
              </SizableText>
              <Button size="$3" mt="$3" onPress={() => router.push('/store' as any)}>
                前往商店
              </Button>
            </YStack>
          )}
          <XStack flexWrap="wrap" p="$2" gap="$2">
            {discoveryPackages.map((pkg: any) => (
              <YStack
                key={pkg.id}
                width={100}
                bg="$color2"
                rounded="$4"
                overflow="hidden"
                cursor="pointer"
                onPress={() => router.push(`/store/${pkg.id}` as any)}
                hoverStyle={{ bg: '$color3' }}
              >
                <YStack height={80} bg="$color3" overflow="hidden">
                  <img
                    src={pkg.coverUrl}
                    alt={pkg.name}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                </YStack>
                <YStack p="$2" gap="$1">
                  <SizableText
                    size="$2"
                    fontWeight="700"
                    color="$color12"
                    numberOfLines={1}
                  >
                    {pkg.name}
                  </SizableText>
                  <SizableText size="$2" color="$color10">
                    {pkg.displayCurrency}
                    {pkg.displayPriceMinor ?? pkg.priceMinor}
                  </SizableText>
                </YStack>
              </YStack>
            ))}
          </XStack>
        </ScrollView>
      )}
    </YStack>
  )
}
