import { valibotResolver } from '@hookform/resolvers/valibot'
import { useEffect } from 'react'
import { Controller, useForm } from 'react-hook-form'
import * as v from 'valibot'
import { SizableText, Spinner, XStack, YStack } from 'tamagui'

import { useTanMutation, useTanQuery, useTanQueryClient } from '~/query'
import { oaClient } from '~/features/oa/client'
import { Button } from '~/interface/buttons/Button'
import { Input } from '~/interface/forms/Input'
import { showToast } from '~/interface/toast/Toast'
import { createRoute } from 'one'

const route =
  createRoute<'/(app)/developers/console/channel/[channelId]/WebhookSettingsSection'>()

const schema = v.object({
  url: v.pipe(v.string(), v.url('Enter a valid URL')),
  useWebhook: v.boolean(),
  webhookRedeliveryEnabled: v.boolean(),
  errorStatisticsEnabled: v.boolean(),
})

type FormData = v.InferInput<typeof schema>

export function WebhookSettingsSection({ channelId }: { channelId: string }) {
  const queryClient = useTanQueryClient()
  const queryKey = ['oa', 'webhook-settings', channelId]
  const { data, isLoading } = useTanQuery({
    queryKey,
    queryFn: () => oaClient.getWebhookSettings({ officialAccountId: channelId }),
    enabled: !!channelId,
  })
  const form = useForm<FormData>({
    resolver: valibotResolver(schema),
    defaultValues: {
      url: '',
      useWebhook: true,
      webhookRedeliveryEnabled: false,
      errorStatisticsEnabled: false,
    },
  })

  useEffect(() => {
    if (data) {
      form.reset({
        url: data.settings?.webhook?.url ?? '',
        useWebhook: data.settings?.useWebhook ?? true,
        webhookRedeliveryEnabled: data.settings?.webhookRedeliveryEnabled ?? false,
        errorStatisticsEnabled: data.settings?.errorStatisticsEnabled ?? false,
      })
    }
  }, [data, form])

  const save = useTanMutation({
    mutationFn: (input: FormData) =>
      oaClient.updateWebhookSettings({
        officialAccountId: channelId,
        url: input.url,
        useWebhook: input.useWebhook,
        webhookRedeliveryEnabled: input.webhookRedeliveryEnabled,
        errorStatisticsEnabled: input.errorStatisticsEnabled,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey })
      void queryClient.invalidateQueries({
        queryKey: ['oa', 'webhook', channelId],
      })
      showToast('Webhook settings saved', { type: 'success' })
    },
    onError: () => showToast('Failed to save webhook settings', { type: 'error' }),
  })

  const verify = useTanMutation({
    mutationFn: () => oaClient.verifyWebhookEndpoint({ officialAccountId: channelId }),
    onSuccess: (res) => {
      void queryClient.invalidateQueries({ queryKey })
      showToast(
        res.result?.success ? 'Webhook verified' : 'Webhook verification failed',
        {
          type: res.result?.success ? 'success' : 'error',
        },
      )
    },
    onError: () => showToast('Failed to verify webhook', { type: 'error' }),
  })

  if (isLoading) return <Spinner />

  return (
    <YStack gap="$4" p="$4" borderWidth={1} borderColor="$borderColor" rounded="$2">
      <XStack justify="space-between" items="center">
        <SizableText size="$5" fontWeight="700" color="$color12">
          Webhook settings
        </SizableText>
        <Button size="$2" variant="outlined" onPress={() => verify.mutate()}>
          Verify
        </Button>
      </XStack>

      <Controller
        control={form.control}
        name="url"
        render={({ field: { value, onChange }, fieldState: { error } }) => (
          <Input
            value={value}
            onChangeText={onChange}
            error={error?.message}
            placeholder="Webhook URL"
            onSubmitEditing={() => {
              void form.handleSubmit((values) => save.mutate(values))()
            }}
          />
        )}
      />

      {(
        ['useWebhook', 'webhookRedeliveryEnabled', 'errorStatisticsEnabled'] as const
      ).map((name) => (
        <Controller
          key={name}
          control={form.control}
          name={name}
          render={({ field: { value, onChange } }) => (
            <XStack justify="space-between" items="center">
              <SizableText size="$3" color="$color11">
                {name === 'useWebhook'
                  ? 'Use webhook'
                  : name === 'webhookRedeliveryEnabled'
                    ? 'Webhook redelivery'
                    : 'Error statistics aggregation'}
              </SizableText>
              <Button
                size="$2"
                variant={value ? undefined : 'outlined'}
                onPress={() => onChange(!value)}
              >
                {value ? 'On' : 'Off'}
              </Button>
            </XStack>
          )}
        />
      ))}

      <XStack justify="space-between" items="center">
        <SizableText size="$2" color="$color10">
          Last verify: {data?.settings?.lastVerifyReason ?? 'Not verified'}
        </SizableText>
        <Button
          size="$2"
          onPress={form.handleSubmit((values) => save.mutate(values))}
          disabled={save.isPending}
        >
          Save
        </Button>
      </XStack>
    </YStack>
  )
}
