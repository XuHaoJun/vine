import { Link } from 'one'
import { useMemo, useState } from 'react'
import { SizableText, XStack, YStack } from 'tamagui'

import { creatorProfileByUserId } from '@vine/zero-schema/queries/creatorProfile'
import { stickerPackagesByCreatorId } from '@vine/zero-schema/queries/stickerPackage'
import { useAuth } from '~/features/auth/client/authClient'
import { useZeroQuery } from '~/zero/client'

const TABS = [
  { key: 'all', label: '全部' },
  { key: 'on_sale', label: '販售中' },
  { key: 'in_review', label: '審核中' },
  { key: 'draft', label: '草稿' },
  { key: 'rejected', label: '未通過' },
] as const

type TabKey = (typeof TABS)[number]['key']

export function CreatorPackageList() {
  const { user } = useAuth()
  const userId = user?.id ?? ''
  const [activeTab, setActiveTab] = useState<TabKey>('all')
  const [profile] = useZeroQuery(
    creatorProfileByUserId,
    { userId },
    { enabled: Boolean(userId) },
  )

  const [packages] = useZeroQuery(
    stickerPackagesByCreatorId,
    { creatorId: profile?.id ?? '' },
    { enabled: Boolean(profile?.id) },
  )

  const filtered = useMemo(() => {
    const list = packages ?? []
    if (activeTab === 'all') return list
    return list.filter((p) => p.status === activeTab)
  }, [packages, activeTab])

  return (
    <YStack flex={1} p="$4" gap="$4">
      <SizableText size="$6" fontWeight="700">
        我的作品
      </SizableText>

      <XStack gap="$2" flexWrap="wrap">
        {TABS.map((tab) => (
          <YStack
            key={tab.key}
            px="$3"
            py="$1.5"
            bg={activeTab === tab.key ? '$color4' : '$color2'}
            rounded="$4"
            cursor="pointer"
            onPress={() => setActiveTab(tab.key)}
          >
            <SizableText size="$3">{tab.label}</SizableText>
          </YStack>
        ))}
      </XStack>

      <YStack gap="$2">
        {filtered.length === 0 && (
          <SizableText color="$color10">沒有符合條件的作品</SizableText>
        )}
        {filtered.map((pkg) => (
          <Link key={pkg.id} href={`/creator/packages/${pkg.id}` as any}>
            <YStack
              p="$3"
              bg="$color2"
              rounded="$4"
              borderWidth={1}
              borderColor="$borderColor"
              gap="$1"
              hoverStyle={{ bg: '$color3' }}
            >
              <XStack justify="space-between" items="center">
                <SizableText size="$4" fontWeight="600">
                  {pkg.name}
                </SizableText>
                <SizableText size="$2" color="$color10">
                  {statusLabel(pkg.status)}
                </SizableText>
              </XStack>
              <SizableText size="$2" color="$color10">
                {pkg.stickerCount} 張貼圖
              </SizableText>
              {pkg.status === 'rejected' && pkg.reviewReasonText && (
                <SizableText size="$2" color="$red9">
                  {pkg.reviewReasonText}
                </SizableText>
              )}
            </YStack>
          </Link>
        ))}
      </YStack>
    </YStack>
  )
}

function statusLabel(status: string) {
  switch (status) {
    case 'on_sale':
      return '販售中'
    case 'in_review':
      return '審核中'
    case 'draft':
      return '草稿'
    case 'rejected':
      return '未通過'
    case 'approved':
      return '已核准'
    default:
      return status
  }
}
