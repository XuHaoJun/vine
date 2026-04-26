import { useMemo, useState } from 'react'
import { SizableText, XStack, YStack } from 'tamagui'

import { Button } from '~/interface/buttons/Button'
import { useTanQuery } from '~/query'
import {
  creatorSalesReportQueryKey,
  formatTwdMinor,
  getCurrentReportMonth,
  shiftReportMonth,
  stickerMarketCreatorClient,
} from '~/features/sticker-market/creator/client'

export function CreatorSalesReport() {
  const [month, setMonth] = useState(() => getCurrentReportMonth())
  const report = useTanQuery({
    queryKey: creatorSalesReportQueryKey(month),
    queryFn: () => stickerMarketCreatorClient.getCreatorSalesReport({ month }),
  })
  const data = report.data
  const maxDailyGross = useMemo(
    () => Math.max(1, ...(data?.dailyRows ?? []).map((row) => row.grossSalesMinor)),
    [data?.dailyRows],
  )

  return (
    <YStack flex={1} minW={0} p="$4" gap="$4">
      <XStack items="center" justify="space-between" gap="$3" flexWrap="wrap">
        <SizableText size="$6" fontWeight="700">
          銷售報表
        </SizableText>
        <XStack items="center" gap="$2">
          <Button variant="outlined" onPress={() => setMonth(shiftReportMonth(month, -1))}>
            上個月
          </Button>
          <SizableText minW={84} text="center" fontWeight="600">
            {month}
          </SizableText>
          <Button variant="outlined" onPress={() => setMonth(shiftReportMonth(month, 1))}>
            下個月
          </Button>
        </XStack>
      </XStack>

      {report.isLoading && <SizableText color="$color10">載入中...</SizableText>}
      {report.isError && <SizableText color="$red10">銷售報表載入失敗</SizableText>}

      {data && (
        <>
          <XStack gap="$3" flexWrap="wrap">
            <MetricCard label="本月銷售" value={formatTwdMinor(data.summary?.grossSalesMinor ?? 0)} />
            <MetricCard
              label="預估分潤"
              value={formatTwdMinor(data.summary?.confirmedRevenueMinor ?? 0)}
            />
            <MetricCard label="銷售件數" value={`${data.summary?.soldCount ?? 0} 份`} />
            <MetricCard
              label="退款扣回"
              value={formatTwdMinor(data.summary?.refundedMinor ?? 0)}
              detail={`${data.summary?.refundedCount ?? 0} 筆`}
            />
            <MetricCard
              label="退款處理中"
              value={formatTwdMinor(data.summary?.refundPendingMinor ?? 0)}
              detail={`${data.summary?.refundPendingCount ?? 0} 筆`}
            />
          </XStack>

          <YStack gap="$3">
            <SizableText size="$4" fontWeight="700">
              每日銷售趨勢
            </SizableText>
            <XStack height={160} items="flex-end" gap="$1" px="$2" py="$2" bg="$color2" rounded="$4">
              {data.dailyRows.map((row) => {
                const height = row.grossSalesMinor === 0 ? 4 : Math.max(8, (row.grossSalesMinor / maxDailyGross) * 132)
                return (
                  <YStack key={row.date} flex={1} minW={6} items="center" gap="$1">
                    <YStack width="100%" maxW={18} height={height} bg="$green9" rounded="$2" />
                    <SizableText size="$1" color="$color10">
                      {Number(row.date.slice(8, 10))}
                    </SizableText>
                  </YStack>
                )
              })}
            </XStack>
          </YStack>

          <YStack gap="$3">
            <SizableText size="$4" fontWeight="700">
              各貼圖組銷售排行
            </SizableText>
            <YStack bg="$color2" rounded="$4" overflow="hidden">
              {data.packageRows.length === 0 && (
                <SizableText p="$3" color="$color10">
                  這個月份還沒有銷售資料
                </SizableText>
              )}
              {data.packageRows.map((row, index) => (
                <XStack
                  key={row.packageId}
                  px="$3"
                  py="$2"
                  gap="$3"
                  items="center"
                  borderBottomWidth={index === data.packageRows.length - 1 ? 0 : 1}
                  borderBottomColor="$color4"
                >
                  <SizableText width={28} color="$color10">
                    #{index + 1}
                  </SizableText>
                  <SizableText flex={1} minW={0} numberOfLines={1} fontWeight="600">
                    {row.packageName}
                  </SizableText>
                  <SizableText width={72} text="right">
                    {row.soldCount} 份
                  </SizableText>
                  <SizableText width={96} text="right">
                    {formatTwdMinor(row.grossSalesMinor)}
                  </SizableText>
                  <SizableText width={96} text="right" color="$color10">
                    {formatTwdMinor(row.confirmedRevenueMinor)}
                  </SizableText>
                </XStack>
              ))}
            </YStack>
          </YStack>
        </>
      )}
    </YStack>
  )
}

function MetricCard({
  label,
  value,
  detail,
}: {
  label: string
  value: string
  detail?: string | undefined
}) {
  return (
    <YStack flex={1} minW={150} p="$3" bg="$color2" rounded="$4" gap="$1">
      <SizableText size="$2" color="$color10">
        {label}
      </SizableText>
      <SizableText size="$6" fontWeight="700">
        {value}
      </SizableText>
      {detail && (
        <SizableText size="$2" color="$color10">
          {detail}
        </SizableText>
      )}
    </YStack>
  )
}
