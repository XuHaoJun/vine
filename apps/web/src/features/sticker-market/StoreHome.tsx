import { router } from 'one'
import { ScrollView, SizableText, XStack, YStack } from 'tamagui'

import { useAuth } from '~/features/auth/client/authClient'
import { allStickerPackages } from '@vine/zero-schema/queries/stickerPackage'
import { entitlementsByUserId } from '@vine/zero-schema/queries/entitlement'
import { useZeroQuery } from '~/zero/client'

export function StoreHome() {
  const { user } = useAuth()
  const userId = user?.id ?? ''

  const [packages] = useZeroQuery(allStickerPackages, {})
  const [entitlements] = useZeroQuery(entitlementsByUserId, { userId }, { enabled: Boolean(userId) })

  const ownedPackageIds = new Set((entitlements ?? []).map((e) => e.packageId))

  return (
    <YStack flex={1} bg="$background">
      <XStack px="$4" py="$3" items="center" borderBottomWidth={1} borderBottomColor="$color4">
        <SizableText size="$6" fontWeight="700" color="$color12">
          貼圖商店
        </SizableText>
      </XStack>

      <ScrollView flex={1}>
        <YStack p="$4" gap="$3">
          {(!packages || packages.length === 0) && (
            <SizableText size="$4" color="$color10" text="center" mt="$8">
              尚無貼圖套包
            </SizableText>
          )}
          {(packages ?? []).map((pkg) => {
            const owned = ownedPackageIds.has(pkg.id)
            return (
              <YStack
                key={pkg.id}
                bg="$color2"
                rounded="$4"
                overflow="hidden"
                cursor="pointer"
                onPress={() => router.push(`/store/${pkg.id}` as any)}
                hoverStyle={{ bg: '$color3' }}
              >
                <YStack height={160} bg="$color3" overflow="hidden">
                  <img
                    src={`/uploads/${pkg.coverDriveKey}`}
                    alt={pkg.name}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                </YStack>
                <XStack p="$3" items="center" justify="space-between">
                  <YStack flex={1}>
                    <SizableText size="$4" fontWeight="700" color="$color12">
                      {pkg.name}
                    </SizableText>
                    <SizableText size="$3" color="$color10" mt="$1">
                      {pkg.stickerCount} 張貼圖
                    </SizableText>
                  </YStack>
                  {owned ? (
                    <YStack
                      bg="$green8"
                      rounded="$2"
                      px="$2"
                      py="$1"
                    >
                      <SizableText size="$2" color="white">
                        已擁有
                      </SizableText>
                    </YStack>
                  ) : (
                    <SizableText size="$4" fontWeight="700" color="$color12">
                      NT${((pkg.priceMinor ?? 0) / 100).toFixed(0)}
                    </SizableText>
                  )}
                </XStack>
              </YStack>
            )
          })}
        </YStack>
      </ScrollView>
    </YStack>
  )
}
