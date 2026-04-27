import { router } from 'one'
import { ScrollView, SizableText, XStack, YStack } from 'tamagui'

import { TrustReportStatus } from '@vine/proto/stickerMarket'
import { useTanQuery } from '~/query'
import { stickerMarketAdminClient } from '~/features/sticker-market/admin/client'

function statusLabel(status: TrustReportStatus) {
  switch (status) {
    case TrustReportStatus.OPEN:
      return '待處理'
    case TrustReportStatus.REVIEWING:
      return '處理中'
    case TrustReportStatus.RESOLVED:
      return '已處理'
    case TrustReportStatus.DISMISSED:
      return '不處理'
    default:
      return '未知'
  }
}

export function AdminTrustReportsPage() {
  const { data, isLoading } = useTanQuery({
    queryKey: ['sticker-market', 'admin', 'trust-reports'],
    queryFn: () =>
      stickerMarketAdminClient.listTrustReports({
        status: TrustReportStatus.UNSPECIFIED,
        limit: 100,
      }),
  })
  const reports = data?.reports ?? []

  return (
    <YStack flex={1} bg="$background">
      <XStack
        px="$4"
        py="$3"
        items="center"
        borderBottomWidth={1}
        borderBottomColor="$color4"
      >
        <SizableText size="$6" fontWeight="700" color="$color12">
          信任與安全回報
        </SizableText>
      </XStack>
      <ScrollView flex={1}>
        <YStack p="$4" gap="$3">
          {isLoading && <SizableText color="$color10">載入中...</SizableText>}
          {!isLoading && reports.length === 0 && (
            <SizableText color="$color10">尚無回報</SizableText>
          )}
          {reports.map((report) => (
            <YStack
              key={report.id}
              bg="$color2"
              rounded="$4"
              p="$3"
              gap="$2"
              cursor="pointer"
              hoverStyle={{ bg: '$color3' }}
              onPress={() => router.push(`/admin/trust-reports/${report.id}` as any)}
            >
              <XStack justify="space-between" items="center">
                <SizableText size="$4" fontWeight="700" color="$color12">
                  {report.packageName}
                </SizableText>
                <SizableText size="$2" color="$color10">
                  {statusLabel(report.status)}
                </SizableText>
              </XStack>
              <SizableText size="$3" color="$color10">
                {report.reasonCategory} · {report.creatorDisplayName || report.creatorId}
              </SizableText>
              <SizableText size="$3" color="$color11" numberOfLines={2}>
                {report.reasonText}
              </SizableText>
            </YStack>
          ))}
        </YStack>
      </ScrollView>
    </YStack>
  )
}
