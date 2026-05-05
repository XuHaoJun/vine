import { useParams, createRoute } from 'one'
import { useState } from 'react'
import { useTanQuery, useTanMutation, useTanQueryClient } from '~/query'
import { miniAppClient } from '~/features/mini-app/client'
import {
  Button,
  Input,
  ScrollView,
  Select,
  Stack,
  Text,
  XStack,
  YStack,
} from 'tamagui'
import { showToast } from '~/interface/toast/Toast'

const route = createRoute<'/(app)/developers/console/provider/[providerId]/mini-app/[miniAppId]/service-templates'>()

const KINDS = [
  'reservation_confirmation',
  'queue_position',
  'delivery_update',
  'generic_notification',
  'custom_flex',
]

export default function ServiceTemplatesPage() {
  const { miniAppId } = useParams<{ miniAppId: string }>()
  const qc = useTanQueryClient()

  const list = useTanQuery({
    queryKey: ['miniApp', 'templates', miniAppId],
    queryFn: () => miniAppClient.listServiceTemplates({ miniAppId }),
  })

  const [showAdd, setShowAdd] = useState(false)
  const [kind, setKind] = useState(KINDS[0])
  const [language, setLanguage] = useState('en')
  const [name, setName] = useState('')
  const [flexJson, setFlexJson] = useState('{ "type": "bubble" }')
  const [useCase, setUseCase] = useState('')

  const create = useTanMutation({
    mutationFn: () =>
      miniAppClient.createServiceTemplate({
        miniAppId,
        kind,
        languageTag: language,
        name,
        flexJson,
        paramsSchema: [],
        useCase,
      }),
    onSuccess: () => {
      showToast('Template added', { type: 'success' })
      setShowAdd(false)
      setName('')
      setUseCase('')
      qc.invalidateQueries({ queryKey: ['miniApp', 'templates', miniAppId] })
    },
    onError: (e) => showToast(`Failed: ${(e as Error).message}`, { type: 'error' }),
  })

  const remove = useTanMutation({
    mutationFn: (id: string) => miniAppClient.deleteServiceTemplate({ id }),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ['miniApp', 'templates', miniAppId] }),
  })

  const test = useTanMutation({
    mutationFn: (templateId: string) =>
      miniAppClient.sendTestServiceMessage({ templateId, params: {} }),
    onSuccess: () => showToast('Test message sent — check your "Mini App 通知" chat', { type: 'success' }),
    onError: (e) => showToast(`Failed: ${(e as Error).message}`, { type: 'error' }),
  })

  return (
    <YStack p="$4" gap="$4" maxWidth={720}>
      <XStack justify="space-between" items="center">
        <Text fontSize={20} fontWeight="700" color="$color12">
          Service Message Templates
        </Text>
        <Button size="$3" onPress={() => setShowAdd(!showAdd)}>
          {showAdd ? 'Cancel' : 'Add'}
        </Button>
      </XStack>

      {showAdd && (
        <YStack
          p="$3"
          rounded="$3"
          borderWidth={1}
          borderColor="$borderColor"
          gap="$2"
        >
          <Text fontSize={14} fontWeight="600">Kind</Text>
          <Select value={kind} onValueChange={setKind}>
            <Select.Trigger><Select.Value /></Select.Trigger>
            <Select.Content>
              {KINDS.map((k) => (
                <Select.Item key={k} value={k}>
                  <Select.ItemText>{k}</Select.ItemText>
                </Select.Item>
              ))}
            </Select.Content>
          </Select>

          <Text fontSize={14} fontWeight="600">Language</Text>
          <Input value={language} onChangeText={setLanguage} placeholder="en, zh-Hant, ..." />

          <Text fontSize={14} fontWeight="600">Template name</Text>
          <Input
            value={name}
            onChangeText={setName}
            placeholder={`${kind}_${language}`}
          />

          <Text fontSize={14} fontWeight="600">Flex JSON</Text>
          <Input
            multiline
            numberOfLines={8}
            value={flexJson}
            onChangeText={setFlexJson}
          />

          <Text fontSize={14} fontWeight="600">Use case</Text>
          <Input value={useCase} onChangeText={setUseCase} />

          <Button
            theme="active"
            disabled={!name || create.isPending}
            onPress={() => create.mutate()}
          >
            {create.isPending ? 'Adding...' : 'Add'}
          </Button>
        </YStack>
      )}

      <YStack gap="$2">
        {list.data?.templates.map((t) => (
          <Stack
            key={t.id}
            p="$3"
            rounded="$3"
            borderWidth={1}
            borderColor="$borderColor"
          >
            <XStack justify="space-between" items="center">
              <YStack>
                <Text fontWeight="600">{t.name}</Text>
                <Text fontSize={11} color="$color10">
                  {t.kind} · {t.languageTag}
                </Text>
                {t.useCase && (
                  <Text fontSize={13} color="$color10">
                    {t.useCase}
                  </Text>
                )}
              </YStack>
              <XStack gap="$2">
                <Button size="$2" onPress={() => test.mutate(t.id)}>
                  Send test
                </Button>
                <Button
                  size="$2"
                  theme="red"
                  onPress={() => remove.mutate(t.id)}
                >
                  Delete
                </Button>
              </XStack>
            </XStack>
          </Stack>
        ))}
        {list.data?.templates.length === 0 && (
          <Text color="$color10">No templates yet.</Text>
        )}
      </YStack>
    </YStack>
  )
}
