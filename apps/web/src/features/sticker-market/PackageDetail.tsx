import { useState } from 'react'
import { router } from 'one'
import { ScrollView, SizableText, XStack, YStack } from 'tamagui'

import { useAuth } from '~/features/auth/client/authClient'
import { stickerPackageById } from '@vine/zero-schema/queries/stickerPackage'
import { entitlementsByUserId } from '@vine/zero-schema/queries/entitlement'
import { useZeroQuery } from '~/zero/client'
import { Button } from '~/interface/buttons/Button'
import { CheckoutSheet } from './CheckoutSheet'

type PackageDetailProps = {
  packageId: string
}

export function PackageDetail({ packageId }: PackageDetailProps) {
  const { user } = useAuth()
  const userId = user?.id ?? ''
  const [checkoutOpen, setCheckoutOpen] = useState(false)

  const [pkg] = useZeroQuery(stickerPackageById, { packageId })
  const [entitlements] = useZeroQuery(
    entitlementsByUserId,
    { userId },
    { enabled: Boolean(userId) },
  )

  const owned = (entitlements ?? []).some((e) => e.packageId === packageId)

  if (!pkg) {
    return (
      <YStack flex={1} items="center" justify="center">
        <SizableText size="$4" color="$color10">
          載入中...
        </SizableText>
      </YStack>
    )
  }

  const priceDisplay = `NT$${pkg.priceMinor ?? 0}`

  // Mock sticker previews (sticker count boxes)
  const stickerCount = Math.min(pkg.stickerCount ?? 0, 16)
  const stickerIndices = Array.from({ length: stickerCount }, (_, i) => i)

  return (
    <YStack flex={1} bg="$background">
      {/* Header */}
      <XStack px="$4" py="$3" items="center" gap="$3" borderBottomWidth={1} borderBottomColor="$color4">
        <YStack cursor="pointer" onPress={() => router.back()}>
          <SizableText size="$5" color="$color12">‹</SizableText>
        </YStack>
        <SizableText size="$5" fontWeight="700" color="$color12" flex={1}>
          {pkg.name}
        </SizableText>
      </XStack>

      <ScrollView flex={1}>
        {/* Cover */}
        <YStack height={240} bg="$color3" overflow="hidden">
          <img
            src={`/uploads/${pkg.coverDriveKey}`}
            alt={pkg.name}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        </YStack>

        <YStack p="$4" gap="$4">
          {/* Name + price */}
          <XStack justify="space-between" items="flex-start">
            <YStack flex={1}>
              <SizableText size="$6" fontWeight="700" color="$color12">
                {pkg.name}
              </SizableText>
              {pkg.description ? (
                <SizableText size="$3" color="$color10" mt="$1">
                  {pkg.description}
                </SizableText>
              ) : null}
            </YStack>
            <SizableText size="$5" fontWeight="700" color="$color12" ml="$4">
              {priceDisplay}
            </SizableText>
          </XStack>

          {/* Sticker grid preview */}
          {stickerIndices.length > 0 && (
            <YStack gap="$2">
              <SizableText size="$4" fontWeight="600" color="$color11">
                貼圖預覽
              </SizableText>
              <XStack flexWrap="wrap" gap="$2">
                {stickerIndices.map((i) => (
                  <YStack
                    key={i}
                    width={72}
                    height={72}
                    rounded="$3"
                    bg="$color3"
                    items="center"
                    justify="center"
                  >
                    <SizableText size="$2" color="$color9">{i + 1}</SizableText>
                  </YStack>
                ))}
              </XStack>
            </YStack>
          )}
        </YStack>
      </ScrollView>

      {/* Sticky bottom buy button */}
      <YStack
        px="$4"
        py="$3"
        borderTopWidth={1}
        borderTopColor="$color4"
        bg="$background"
      >
        {owned ? (
          <Button disabled>
            <SizableText>已擁有</SizableText>
          </Button>
        ) : (
          <Button theme="accent" onPress={() => setCheckoutOpen(true)}>
            立即購買 {priceDisplay}
          </Button>
        )}
      </YStack>

      <CheckoutSheet
        pkg={pkg}
        open={checkoutOpen}
        onOpenChange={setCheckoutOpen}
      />
    </YStack>
  )
}
