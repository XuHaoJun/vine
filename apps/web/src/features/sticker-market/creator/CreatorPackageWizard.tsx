import { router } from 'one'
import { useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { valibotResolver } from '@hookform/resolvers/valibot'
import { Checkbox, Label, SizableText, XStack, YStack } from 'tamagui'

import { Button } from '~/interface/buttons/Button'
import { Input } from '~/interface/forms/Input'
import { Select } from '~/interface/forms/Select'
import { TextArea } from '~/interface/forms/TextArea'
import { showToast } from '~/interface/toast/Toast'
import { stickerMarketCreatorClient } from '~/features/sticker-market/creator/client'
import { stickerPackageDraftSchema } from '~/features/sticker-market/creator/schema'
import { useTanMutation } from '~/query'

import type { StickerPackageDraftFormData } from '~/features/sticker-market/creator/schema'

function tagsTextToJson(tagsText: string) {
  return JSON.stringify(
    tagsText
      .split(',')
      .map((tag) => tag.trim())
      .filter(Boolean)
      .slice(0, 10),
  )
}

async function fileToBytes(file: File) {
  return new Uint8Array(await file.arrayBuffer())
}

const STICKER_COUNT_OPTIONS = [
  { label: '8 張', value: '8' },
  { label: '16 張', value: '16' },
  { label: '24 張', value: '24' },
  { label: '32 張', value: '32' },
  { label: '40 張', value: '40' },
]

export function CreatorPackageWizard() {
  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [packageId, setPackageId] = useState<string>('')
  const [uploadResult, setUploadResult] = useState<{ valid: boolean; items: any[] } | null>(null)

  const {
    control,
    handleSubmit,
    watch,
    formState: { isSubmitting },
  } = useForm<StickerPackageDraftFormData>({
    resolver: valibotResolver(stickerPackageDraftSchema),
    defaultValues: {
      name: '',
      description: '',
      priceMinor: 0,
      stickerCount: 8,
      tagsText: '',
      copyrightText: '',
      licenseConfirmed: false,
      autoPublish: true,
    },
  })

  const createDraft = useTanMutation({
    mutationFn: (data: StickerPackageDraftFormData) =>
      stickerMarketCreatorClient.createStickerPackageDraft({
        name: data.name,
        description: data.description,
        priceMinor: data.priceMinor,
        stickerCount: data.stickerCount,
        tagsJson: tagsTextToJson(data.tagsText),
        copyrightText: data.copyrightText,
        licenseConfirmed: data.licenseConfirmed,
        autoPublish: data.autoPublish,
      }),
    onSuccess: (res) => {
      if (res.package?.id) {
        setPackageId(res.package.id)
        setStep(2)
      }
    },
    onError: () => {
      showToast('建立草稿失敗', { type: 'error' })
    },
  })

  const uploadAssets = useTanMutation({
    mutationFn: async ({ packageId, file }: { packageId: string; file: File }) => {
      const bytes = await fileToBytes(file)
      return stickerMarketCreatorClient.uploadStickerPackageAssets({
        packageId,
        zipFile: bytes,
      })
    },
    onSuccess: (res) => {
      setUploadResult({ valid: res.valid, items: res.items })
      if (res.valid) {
        setStep(3)
      } else {
        showToast('素材驗證失敗，請檢查問題後重新上傳', { type: 'error' })
      }
    },
    onError: () => {
      showToast('上傳失敗', { type: 'error' })
    },
  })

  const submitReview = useTanMutation({
    mutationFn: (id: string) =>
      stickerMarketCreatorClient.submitStickerPackageReview({ packageId: id }),
    onSuccess: () => {
      showToast('已提交審核', { type: 'success' })
      router.push('/creator/packages' as any)
    },
    onError: () => {
      showToast('提交審核失敗', { type: 'error' })
    },
  })

  const onStep1Submit = (data: StickerPackageDraftFormData) => {
    createDraft.mutate(data)
  }

  const onUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !packageId) return
    uploadAssets.mutate({ packageId, file })
  }

  const onSubmitReview = () => {
    if (!packageId) return
    submitReview.mutate(packageId)
  }

  const formValues = watch()

  return (
    <YStack flex={1} p="$4" gap="$4">
      <SizableText size="$6" fontWeight="700">建立新貼圖組</SizableText>

      <XStack gap="$2">
        <StepBadge number={1} active={step === 1} />
        <StepBadge number={2} active={step === 2} />
        <StepBadge number={3} active={step === 3} />
      </XStack>

      {step === 1 && (
        <YStack gap="$3">
          <Controller
            control={control}
            name="name"
            render={({ field: { onChange, value }, fieldState: { error } }) => (
              <Input
                value={value}
                onChangeText={onChange}
                placeholder="貼圖組名稱"
                error={error?.message}
              />
            )}
          />
          <Controller
            control={control}
            name="description"
            render={({ field: { onChange, value }, fieldState: { error } }) => (
              <TextArea
                value={value}
                onChangeText={onChange}
                placeholder="描述（最多 100 字）"
                error={error?.message}
                numberOfLines={3}
              />
            )}
          />
          <Controller
            control={control}
            name="priceMinor"
            render={({ field: { onChange, value }, fieldState: { error } }) => (
              <Input
                value={String(value ?? '')}
                onChangeText={(text) => onChange(Number(text) || 0)}
                placeholder="價格（最小單位，例如 4500 = NT$45）"
                keyboardType="numeric"
                error={error?.message}
              />
            )}
          />
          <Controller
            control={control}
            name="stickerCount"
            render={({ field: { onChange, value }, fieldState: { error } }) => (
              <Select
                value={String(value)}
                onValueChange={(v) => onChange(Number(v))}
                options={STICKER_COUNT_OPTIONS}
                placeholder="選擇貼圖數量"
                error={error?.message}
              />
            )}
          />
          <Controller
            control={control}
            name="tagsText"
            render={({ field: { onChange, value }, fieldState: { error } }) => (
              <Input
                value={value}
                onChangeText={onChange}
                placeholder="標籤（以逗號分隔）"
                error={error?.message}
              />
            )}
          />
          <Controller
            control={control}
            name="copyrightText"
            render={({ field: { onChange, value }, fieldState: { error } }) => (
              <Input
                value={value}
                onChangeText={onChange}
                placeholder="版權聲明"
                error={error?.message}
              />
            )}
          />
          <Controller
            control={control}
            name="autoPublish"
            render={({ field: { onChange, value } }) => (
              <XStack gap="$2" items="center">
                <Checkbox
                  id="autoPublish"
                  checked={value}
                  onCheckedChange={(checked) => onChange(checked === true)}
                >
                  <Checkbox.Indicator />
                </Checkbox>
                <Label htmlFor="autoPublish">
                  <SizableText>通過審核後自動上架</SizableText>
                </Label>
              </XStack>
            )}
          />
          <Controller
            control={control}
            name="licenseConfirmed"
            render={({ field: { onChange, value }, fieldState: { error } }) => (
              <YStack gap="$1">
                <XStack gap="$2" items="center">
                  <Checkbox
                    id="licenseConfirmed"
                    checked={value}
                    onCheckedChange={(checked) => onChange(checked === true)}
                  >
                    <Checkbox.Indicator />
                  </Checkbox>
                  <Label htmlFor="licenseConfirmed">
                    <SizableText>我確認這是原創作品或已取得合法授權</SizableText>
                  </Label>
                </XStack>
                {error && (
                  <SizableText size="$2" color="$red9">
                    {error.message}
                  </SizableText>
                )}
              </YStack>
            )}
          />
          <Button
            disabled={isSubmitting || createDraft.isPending}
            onPress={handleSubmit(onStep1Submit)}
          >
            下一步：上傳素材
          </Button>
        </YStack>
      )}

      {step === 2 && (
        <YStack gap="$4">
          <SizableText>請上傳包含貼圖素材的 ZIP 檔案</SizableText>
          <input
            type="file"
            accept=".zip"
            onChange={onUpload}
            disabled={uploadAssets.isPending}
          />
          {uploadResult && !uploadResult.valid && (
            <YStack gap="$2">
              <SizableText color="$red9">驗證失敗：</SizableText>
              {uploadResult.items.map((item, i) => (
                <SizableText key={i} size="$2" color="$color10">
                  {item.fileName} - {item.message}
                </SizableText>
              ))}
            </YStack>
          )}
        </YStack>
      )}

      {step === 3 && (
        <YStack gap="$4">
          <SizableText size="$5" fontWeight="600">確認並提交審核</SizableText>
          <YStack gap="$2">
            <SizableText>名稱：{formValues.name}</SizableText>
            <SizableText>描述：{formValues.description}</SizableText>
            <SizableText>價格：{formValues.priceMinor}</SizableText>
            <SizableText>貼圖數量：{formValues.stickerCount} 張</SizableText>
            <SizableText>版權聲明：{formValues.copyrightText}</SizableText>
            <SizableText>自動上架：{formValues.autoPublish ? '是' : '否'}</SizableText>
          </YStack>
          <Button
            disabled={submitReview.isPending}
            onPress={onSubmitReview}
          >
            提交審核
          </Button>
        </YStack>
      )}
    </YStack>
  )
}

function StepBadge({ number, active }: { number: number; active: boolean }) {
  return (
    <YStack
      width={28}
      height={28}
      rounded={9999}
      bg={active ? '$color4' : '$color2'}
      items="center"
      justify="center"
    >
      <SizableText size="$2" fontWeight="700">
        {number}
      </SizableText>
    </YStack>
  )
}
