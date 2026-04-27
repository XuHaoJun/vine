import { useState, useEffect } from 'react'
import { router } from 'one'
import { ScrollView, SizableText, XStack, YStack } from 'tamagui'

import { Input } from '~/interface/forms/Input'
import { Button } from '~/interface/buttons/Button'
import { useTanQuery } from '~/query'
import { stickerMarketDiscoveryClient } from './client'

const SORT_OPTIONS = [
  { key: '', label: '相關性' },
  { key: 'newest', label: '最新' },
  { key: 'price_asc', label: '價格低到高' },
  { key: 'price_desc', label: '價格高到低' },
  { key: 'rating', label: '評分' },
]

export function SearchResultsPage() {
  const [params, setParams] = useState(() => {
    if (typeof window === 'undefined') return { q: '', type: '', sort: '' }
    const sp = new URLSearchParams(window.location.search)
    return {
      q: sp.get('q') ?? '',
      type: sp.get('type') ?? '',
      sort: sp.get('sort') ?? '',
    }
  })
  const [query, setQuery] = useState(params.q)
  const [pageToken, setPageToken] = useState('')
  const [allResults, setAllResults] = useState<any[]>([])

  const { data, isFetching } = useTanQuery({
    queryKey: ['sticker-market', 'search', params.q, params.type, params.sort, pageToken],
    queryFn: () =>
      stickerMarketDiscoveryClient.searchStickerPackages({
        query: params.q,
        stickerType: params.type,
        sort: params.sort,
        pageSize: 20,
        pageToken,
        priceMin: 0,
        priceMax: 0,
        ownedOnly: false,
        creatorId: '',
        locale: '',
      }),
  })

  useEffect(() => {
    if (data) {
      if (!pageToken) {
        setAllResults(data.results ?? [])
      } else {
        setAllResults((prev) => [...prev, ...(data.results ?? [])])
      }
    }
  }, [data, pageToken])

  const handleSearch = () => {
    const q = query.trim()
    window.history.replaceState(
      null,
      '',
      `/store/search${q ? `?q=${encodeURIComponent(q)}` : ''}`,
    )
    setParams((prev) => ({ ...prev, q }))
    setPageToken('')
    setAllResults([])
  }

  const handleSort = (sort: string) => {
    setParams((prev) => ({ ...prev, sort }))
    setPageToken('')
    setAllResults([])
  }

  const handleLoadMore = () => {
    if (data?.nextPageToken) {
      setPageToken(data.nextPageToken)
    }
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
        <YStack cursor="pointer" onPress={() => router.back()}>
          <SizableText size="$5" color="$color12">
            ‹
          </SizableText>
        </YStack>
        <SizableText size="$5" fontWeight="700" color="$color12" flex={1}>
          搜尋結果
        </SizableText>
      </XStack>

      <YStack px="$4" pt="$3" pb="$2" gap="$2">
        <Input
          value={query}
          onChangeText={setQuery}
          placeholder="搜尋貼圖..."
          returnKeyType="search"
          onSubmitEditing={handleSearch}
        />
        {params.q && (
          <XStack gap="$2" flexWrap="wrap">
            {SORT_OPTIONS.map((opt) => (
              <YStack
                key={opt.key}
                bg={params.sort === opt.key ? '$color5' : '$color3'}
                rounded="$4"
                px="$3"
                py="$1"
                cursor="pointer"
                onPress={() => handleSort(opt.key)}
              >
                <SizableText size="$2" color="$color12">
                  {opt.label}
                </SizableText>
              </YStack>
            ))}
          </XStack>
        )}
      </YStack>

      <ScrollView flex={1}>
        <YStack p="$4" gap="$3">
          {allResults.length === 0 && !isFetching && (
            <SizableText size="$4" color="$color10" text="center" mt="$8">
              找不到符合的貼圖
            </SizableText>
          )}

          {allResults.map((pkg: any) => (
            <YStack
              key={pkg.id}
              bg="$color2"
              rounded="$4"
              overflow="hidden"
              cursor="pointer"
              onPress={() => router.push(`/store/${pkg.id}` as any)}
              hoverStyle={{ bg: '$color3' }}
            >
              <XStack height={100}>
                <YStack width={100} bg="$color3" overflow="hidden">
                  <img
                    src={pkg.coverUrl}
                    alt={pkg.name}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                </YStack>
                <YStack flex={1} p="$3" justify="center" gap="$1">
                  <SizableText
                    size="$4"
                    fontWeight="700"
                    color="$color12"
                    numberOfLines={1}
                  >
                    {pkg.name}
                  </SizableText>
                  <SizableText size="$3" color="$color10" numberOfLines={1}>
                    {pkg.creatorDisplayName}
                  </SizableText>
                  <XStack items="center" gap="$2">
                    {pkg.owned ? (
                      <YStack bg="$green8" rounded="$2" px="$2" py="$1">
                        <SizableText size="$2" color="white">
                          已擁有
                        </SizableText>
                      </YStack>
                    ) : (
                      <SizableText size="$4" fontWeight="700" color="$color12">
                        {pkg.displayCurrency}
                        {pkg.displayPriceMinor ?? pkg.priceMinor}
                      </SizableText>
                    )}
                    {pkg.averageRating > 0 && (
                      <SizableText size="$2" color="$color10">
                        ★ {pkg.averageRating.toFixed(1)}
                      </SizableText>
                    )}
                  </XStack>
                </YStack>
              </XStack>
            </YStack>
          ))}

          {data?.nextPageToken && (
            <Button variant="outlined" onPress={handleLoadMore} disabled={isFetching}>
              載入更多
            </Button>
          )}

          {isFetching && (
            <SizableText size="$3" color="$color10" text="center">
              載入中...
            </SizableText>
          )}
        </YStack>
      </ScrollView>
    </YStack>
  )
}
