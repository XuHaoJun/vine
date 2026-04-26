import { useMemo } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { valibotResolver } from '@hookform/resolvers/valibot'
import { SizableText, XStack, YStack } from 'tamagui'

import { creatorProfileByUserId } from '@vine/zero-schema/queries/creatorProfile'
import { stickerPackagesByCreatorId } from '@vine/zero-schema/queries/stickerPackage'
import { Button } from '~/interface/buttons/Button'
import { Input } from '~/interface/forms/Input'
import { TextArea } from '~/interface/forms/TextArea'
import { showToast } from '~/interface/toast/Toast'
import { useAuth } from '~/features/auth/client/authClient'
import { stickerMarketCreatorClient } from '~/features/sticker-market/creator/client'
import { creatorProfileSchema } from '~/features/sticker-market/creator/schema'
import { useZeroQuery } from '~/zero/client'
import { useTanMutation } from '~/query'

import type { CreatorProfileFormData } from '~/features/sticker-market/creator/schema'

export function CreatorDashboard() {
  const { user } = useAuth()
  const userId = user?.id ?? ''

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

  const stats = useMemo(() => {
    const list = packages ?? []
    return {
      packageCount: list.length,
      inReviewCount: list.filter((p) => p.status === 'in_review').length,
      rejectedCount: list.filter((p) => p.status === 'rejected').length,
    }
  }, [packages])

  return (
    <YStack flex={1} p="$4" gap="$4">
      <SizableText size="$6" fontWeight="700">
        創作者概覽
      </SizableText>

      {!profile && <CreatorProfileForm userId={userId} />}

      <XStack gap="$3" flexWrap="wrap">
        <YStack flex={1} minW={140} p="$3" bg="$color2" rounded="$4" gap="$1">
          <SizableText size="$2" color="$color10">
            作品總數
          </SizableText>
          <SizableText size="$7" fontWeight="700">
            {stats.packageCount}
          </SizableText>
        </YStack>
        <YStack flex={1} minW={140} p="$3" bg="$color2" rounded="$4" gap="$1">
          <SizableText size="$2" color="$color10">
            審核中
          </SizableText>
          <SizableText size="$7" fontWeight="700">
            {stats.inReviewCount}
          </SizableText>
        </YStack>
        <YStack flex={1} minW={140} p="$3" bg="$color2" rounded="$4" gap="$1">
          <SizableText size="$2" color="$color10">
            未通過
          </SizableText>
          <SizableText size="$7" fontWeight="700">
            {stats.rejectedCount}
          </SizableText>
        </YStack>
      </XStack>

      <YStack p="$3" bg="$color2" rounded="$4" gap="$1">
        <SizableText size="$3" fontWeight="600">
          銷售報表
        </SizableText>
        <SizableText color="$color10">銷售報表將在 Phase 2B 開放</SizableText>
      </YStack>
    </YStack>
  )
}

function CreatorProfileForm({ userId }: { userId: string }) {
  const {
    control,
    handleSubmit,
    formState: { isSubmitting },
  } = useForm<CreatorProfileFormData>({
    resolver: valibotResolver(creatorProfileSchema),
    defaultValues: { displayName: '', country: '', bio: '' },
  })

  const upsert = useTanMutation({
    mutationFn: (data: CreatorProfileFormData) =>
      stickerMarketCreatorClient.upsertCreatorProfile(data),
    onSuccess: () => {
      showToast('創作者資料已儲存', { type: 'success' })
    },
    onError: () => {
      showToast('儲存失敗', { type: 'error' })
    },
  })

  const onSubmit = (data: CreatorProfileFormData) => {
    if (!userId) return
    upsert.mutate(data)
  }

  return (
    <YStack gap="$3" p="$3" bg="$color2" rounded="$4">
      <SizableText size="$4" fontWeight="600">
        建立創作者資料
      </SizableText>
      <Controller
        control={control}
        name="displayName"
        render={({ field: { onChange, value }, fieldState: { error } }) => (
          <Input
            value={value}
            onChangeText={onChange}
            placeholder="創作者名稱"
            error={error?.message}
          />
        )}
      />
      <Controller
        control={control}
        name="country"
        render={({ field: { onChange, value }, fieldState: { error } }) => (
          <Input
            value={value}
            onChangeText={onChange}
            placeholder="國家或地區"
            error={error?.message}
          />
        )}
      />
      <Controller
        control={control}
        name="bio"
        render={({ field: { onChange, value }, fieldState: { error } }) => (
          <TextArea
            value={value}
            onChangeText={onChange}
            placeholder="簡介"
            error={error?.message}
            numberOfLines={3}
          />
        )}
      />
      <Button
        disabled={isSubmitting || upsert.isPending}
        onPress={handleSubmit(onSubmit)}
      >
        儲存資料
      </Button>
    </YStack>
  )
}
