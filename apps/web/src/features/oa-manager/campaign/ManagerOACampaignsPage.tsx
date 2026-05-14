import { valibotResolver } from '@hookform/resolvers/valibot'
import { useRouter } from 'one'
import { useMemo, useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { ScrollView, SizableText, XStack, YStack } from 'tamagui'
import * as v from 'valibot'
import { Button } from '~/interface/buttons/Button'
import { dialogConfirm } from '~/interface/dialogs/actions'
import { Input } from '~/interface/forms/Input'
import { Select } from '~/interface/forms/Select'
import { TextArea } from '~/interface/forms/TextArea'
import { showToast } from '~/interface/toast/Toast'
import { defaultAudienceQuery } from './audienceQueryForm'
import { useManagerOAAudienceFilters } from './useManagerOAAudienceFilters'
import { useManagerOACampaigns, type CampaignItem } from './useManagerOACampaigns'

const defaultAudienceValue = '__default_friends__'

const campaignSchema = v.object({
  name: v.pipe(
    v.string(),
    v.nonEmpty('Campaign name is required'),
    v.maxLength(100, 'Campaign name must be 100 characters or less'),
  ),
  audienceFilterId: v.string(),
  messageText: v.pipe(
    v.string(),
    v.nonEmpty('Message text is required'),
    v.maxLength(5000, 'Message text must be 5000 characters or less'),
  ),
})

type CampaignFormData = v.InferInput<typeof campaignSchema>

type Props = {
  oaId: string
}

function formatDate(timestamp: number | null | undefined): string {
  return timestamp ? new Date(timestamp).toLocaleString() : '-'
}

function formatCampaignAudience(
  campaign: CampaignItem,
  filterNameById: Map<string, string>,
) {
  if (campaign.audienceFilterId) {
    return filterNameById.get(campaign.audienceFilterId) ?? 'Deleted filter'
  }
  if (campaign.inlineAudienceQueryJson) return 'Inline filter'
  return 'Friends'
}

export function ManagerOACampaignsPage({ oaId }: Props) {
  const router = useRouter()
  const { filters, previewAudience } = useManagerOAAudienceFilters(oaId)
  const { campaigns, sendTextCampaign } = useManagerOACampaigns(oaId)
  const [previewCount, setPreviewCount] = useState<number | null>(null)

  const filterNameById = useMemo(
    () => new Map(filters.map((filter) => [filter.id, filter.name])),
    [filters],
  )
  const audienceOptions = useMemo(
    () => [
      { label: 'Friends', value: defaultAudienceValue },
      ...filters.map((filter) => ({ label: filter.name, value: filter.id })),
    ],
    [filters],
  )

  const {
    control,
    handleSubmit,
    watch,
    reset,
    formState: { isSubmitting },
  } = useForm<CampaignFormData>({
    resolver: valibotResolver(campaignSchema),
    defaultValues: {
      name: '',
      audienceFilterId: defaultAudienceValue,
      messageText: '',
    },
  })

  const selectedAudienceFilterId = watch('audienceFilterId')
  const selectedFilter = filters.find((filter) => filter.id === selectedAudienceFilterId)

  const previewSelectedAudience = async () => {
    const query = selectedFilter?.queryJson ?? defaultAudienceQuery
    try {
      const result = await previewAudience.mutateAsync(query)
      setPreviewCount(result.count)
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to preview audience', {
        type: 'error',
      })
    }
  }

  const sendCampaign = handleSubmit(async (data) => {
    const confirmed = await dialogConfirm({
      title: 'Send campaign?',
      description: `Send "${data.name}" to the selected audience now?`,
    })
    if (!confirmed) return

    try {
      await sendTextCampaign.mutateAsync({
        name: data.name,
        messageText: data.messageText,
        audienceFilterId:
          data.audienceFilterId === defaultAudienceValue
            ? undefined
            : data.audienceFilterId,
      })
      showToast('Campaign queued', { type: 'success' })
      setPreviewCount(null)
      reset({
        name: '',
        audienceFilterId: data.audienceFilterId,
        messageText: '',
      })
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to send campaign', {
        type: 'error',
      })
    }
  })

  return (
    <YStack gap="$6">
      <XStack items="flex-start" gap="$4" $platform-web={{ flexWrap: 'wrap' }}>
        <YStack
          flex={1}
          minW={360}
          borderWidth={1}
          borderColor="$borderColor"
          rounded="$3"
          p="$4"
          gap="$4"
        >
          <XStack items="center" justify="space-between" gap="$3">
            <SizableText size="$6" fontWeight="700" color="$color12">
              Campaigns
            </SizableText>
            <Button
              size="$2"
              variant="outlined"
              onPress={() =>
                router.navigate(`/manager/${oaId}/campaigns/audiences` as any)
              }
            >
              Audiences
            </Button>
          </XStack>

          <YStack gap="$2">
            <SizableText size="$2" fontWeight="600">
              Campaign name
            </SizableText>
            <Controller
              control={control}
              name="name"
              render={({ field: { onChange, value }, fieldState: { error } }) => (
                <Input
                  value={value}
                  onChangeText={onChange}
                  placeholder="May promotion"
                  size="$3"
                  error={error?.message}
                />
              )}
            />
          </YStack>

          <YStack gap="$2">
            <SizableText size="$2" fontWeight="600">
              Audience
            </SizableText>
            <Controller
              control={control}
              name="audienceFilterId"
              render={({ field: { onChange, value }, fieldState: { error } }) => (
                <Select
                  value={value}
                  onValueChange={(next) => {
                    setPreviewCount(null)
                    onChange(next)
                  }}
                  options={audienceOptions}
                  error={error?.message}
                />
              )}
            />
          </YStack>

          <YStack gap="$2">
            <SizableText size="$2" fontWeight="600">
              Message
            </SizableText>
            <Controller
              control={control}
              name="messageText"
              render={({ field: { onChange, value }, fieldState: { error } }) => (
                <TextArea
                  value={value}
                  onChangeText={onChange}
                  placeholder="Write the outbound message"
                  minH={160}
                  error={error?.message}
                />
              )}
            />
          </YStack>

          <XStack
            p="$3"
            rounded="$3"
            bg="$color3"
            items="center"
            justify="space-between"
            gap="$3"
          >
            <SizableText size="$3" fontWeight="700">
              {previewCount === null
                ? 'Audience not previewed'
                : `${previewCount} recipients`}
            </SizableText>
            <Button
              size="$2"
              variant="outlined"
              onPress={previewSelectedAudience}
              disabled={previewAudience.isPending}
            >
              Preview
            </Button>
          </XStack>

          <XStack justify="flex-end">
            <Button
              size="$3"
              onPress={() => sendCampaign()}
              disabled={isSubmitting || sendTextCampaign.isPending}
            >
              Send
            </Button>
          </XStack>
        </YStack>

        <YStack flex={1} minW={360} gap="$4">
          <XStack items="center" justify="space-between">
            <SizableText size="$5" fontWeight="700" color="$color12">
              History
            </SizableText>
            <SizableText size="$2" color="$color10">
              {campaigns.length} campaigns
            </SizableText>
          </XStack>

          {campaigns.length === 0 ? (
            <YStack
              py="$6"
              items="center"
              borderWidth={1}
              borderColor="$borderColor"
              rounded="$3"
            >
              <SizableText size="$3" color="$color10">
                No campaigns sent
              </SizableText>
            </YStack>
          ) : (
            <ScrollView>
              <YStack gap="$2">
                {campaigns.map((campaign) => (
                  <YStack
                    key={campaign.id}
                    borderWidth={1}
                    borderColor="$borderColor"
                    rounded="$3"
                    p="$3"
                    gap="$2"
                  >
                    <XStack items="center" justify="space-between" gap="$3">
                      <YStack flex={1} minW={0} gap="$1">
                        <SizableText
                          size="$3"
                          fontWeight="700"
                          color="$color12"
                          numberOfLines={1}
                        >
                          {campaign.name}
                        </SizableText>
                        <SizableText size="$1" color="$color10">
                          {formatCampaignAudience(campaign, filterNameById)} -{' '}
                          {formatDate(campaign.createdAt)}
                        </SizableText>
                      </YStack>
                      <YStack px="$2" py="$1" rounded="$2" bg="$color3">
                        <SizableText size="$1" fontWeight="700">
                          {campaign.status}
                        </SizableText>
                      </YStack>
                    </XStack>
                    <SizableText size="$2" color="$color10" numberOfLines={2}>
                      {campaign.messageText}
                    </SizableText>
                    <XStack gap="$3" $platform-web={{ flexWrap: 'wrap' }}>
                      <SizableText size="$1" color="$color10">
                        Recipients {campaign.recipientSnapshotCount}
                      </SizableText>
                      <SizableText size="$1" color="$color10">
                        Success {campaign.successCount}
                      </SizableText>
                      <SizableText size="$1" color="$color10">
                        Failed {campaign.failedCount}
                      </SizableText>
                      <SizableText size="$1" color="$color10">
                        Sent {formatDate(campaign.sentAt)}
                      </SizableText>
                    </XStack>
                  </YStack>
                ))}
              </YStack>
            </ScrollView>
          )}
        </YStack>
      </XStack>
    </YStack>
  )
}
