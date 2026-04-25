import { useState } from 'react'
import { ScrollView, SizableText, XStack, YStack } from 'tamagui'

import { useAuth } from '~/features/auth/client/authClient'
import { allStickerPackages } from '@vine/zero-schema/queries/stickerPackage'
import { entitlementsByUserId } from '@vine/zero-schema/queries/entitlement'
import { useZeroQuery } from '~/zero/client'

type Props = {
  onSelect: (packageId: string, stickerId: number) => void
}

export function StickerPicker({ onSelect }: Props) {
  const { user } = useAuth()
  const userId = user?.id ?? ''
  const [selectedPackageId, setSelectedPackageId] = useState<string | null>(null)

  const [packages] = useZeroQuery(allStickerPackages, {})
  const [entitlements] = useZeroQuery(
    entitlementsByUserId,
    { userId },
    { enabled: Boolean(userId) },
  )

  const ownedIds = new Set((entitlements ?? []).map((e) => e.packageId))
  const ownedPackages = (packages ?? []).filter((p) => ownedIds.has(p.id))

  const activePackage =
    ownedPackages.find((p) => p.id === selectedPackageId) ?? ownedPackages[0] ?? null

  if (ownedPackages.length === 0) {
    return (
      <YStack height={180} items="center" justify="center" bg="$background">
        <SizableText size="$3" color="$color10">
          還沒有貼圖，前往貼圖商店購買！
        </SizableText>
      </YStack>
    )
  }

  const stickerCount = activePackage?.stickerCount ?? 0

  return (
    <YStack height={240} bg="$background" borderTopWidth={1} borderTopColor="$color4">
      {/* Package tabs */}
      <XStack borderBottomWidth={1} borderBottomColor="$color4">
        {ownedPackages.map((pkg) => (
          <YStack
            key={pkg.id}
            onPress={() => setSelectedPackageId(pkg.id)}
            px="$2"
            py="$1.5"
            borderBottomWidth={2}
            borderBottomColor={activePackage?.id === pkg.id ? '$color12' : 'transparent'}
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

      {/* Sticker grid */}
      <ScrollView flex={1}>
        <XStack flexWrap="wrap" p="$2" gap="$1">
          {Array.from({ length: stickerCount }, (_, i) => i + 1).map((stickerId) => (
            <YStack
              key={stickerId}
              onPress={() => activePackage && onSelect(activePackage.id, stickerId)}
              width={72}
              height={72}
              rounded="$3"
              items="center"
              justify="center"
              cursor="pointer"
              hoverStyle={{ bg: '$color3' }}
            >
              <img
                src={`/uploads/stickers/${activePackage?.id}/${stickerId}.png`}
                width={60}
                height={60}
                alt={`sticker ${stickerId}`}
                style={{ objectFit: 'contain' }}
              />
            </YStack>
          ))}
        </XStack>
      </ScrollView>
    </YStack>
  )
}
