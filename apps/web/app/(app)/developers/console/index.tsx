import { useRouter } from 'one'
import { memo, useState } from 'react'
import { ListItem, SizableText, Spinner, XStack, YStack } from 'tamagui'

import { useTanMutation, useTanQuery, useTanQueryClient } from '~/query'
import { oaClient } from '~/features/oa/client'
import { Button } from '~/interface/buttons/Button'
import { Input } from '~/interface/forms/Input'
import { showToast } from '~/interface/toast/Toast'
import { CreateProviderDialog } from '~/interface/dialogs/CreateProviderDialog'

export const ProviderListPage = memo(() => {
  const router = useRouter()
  const [search, setSearch] = useState('')
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const queryClient = useTanQueryClient()

  const { data, isLoading } = useTanQuery({
    queryKey: ['oa', 'providers'],
    queryFn: () => oaClient.listMyProviders({}),
  })

  const createProvider = useTanMutation({
    mutationFn: (name: string) => oaClient.createProvider({ name }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['oa', 'providers'] })
      showToast('Provider created', { type: 'success' })
    },
    onError: () => {
      showToast('Failed to create provider', { type: 'error' })
    },
  })

  const handleCreateProvider = (name: string) => {
    createProvider.mutate(name)
  }

  const providers = data?.providers ?? []
  const filteredProviders = providers.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase()),
  )

  return (
    <YStack gap="$6">
      {/* Page Header */}
      <YStack gap="$4">
        <SizableText size="$8" fontWeight="700" color="$color12">
          TOP
        </SizableText>

        {/* Search + Create */}
        <XStack gap="$3" items="center">
          <YStack flex={1}>
            <Input
              value={search}
              onChangeText={setSearch}
              placeholder="Search providers..."
            />
          </YStack>
          <Button
            onPress={() => setCreateDialogOpen(true)}
            disabled={createProvider.isPending}
          >
            Create Provider
          </Button>
        </XStack>
      </YStack>

      {/* Provider List */}
      {isLoading ? (
        <YStack items="center" py="$10">
          <Spinner size="large" />
        </YStack>
      ) : filteredProviders.length === 0 ? (
        <YStack items="center" py="$10" gap="$3">
          <SizableText size="$5" color="$color10">
            No providers yet
          </SizableText>
          <SizableText size="$3" color="$color10">
            Create your first provider to get started
          </SizableText>
        </YStack>
      ) : (
        <YStack>
          <SizableText size="$3" fontWeight="600" color="$color10" mb="$2">
            Providers ({filteredProviders.length})
          </SizableText>
          <YStack
            borderWidth={1}
            borderColor="$borderColor"
            rounded="$2"
            overflow="hidden"
          >
            {filteredProviders.map((provider, i) => (
              <ListItem
                key={provider.id}
                title={provider.name}
                subTitle={`ID: ${provider.id}`}
                cursor="pointer"
                hoverStyle={{ bg: '$backgroundHover' }}
                py="$3"
                px="$4"
                borderBottomWidth={i < filteredProviders.length - 1 ? 1 : 0}
                borderColor="$borderColor"
                onPress={() =>
                  router.push(`/developers/console/provider/${provider.id}` as never)
                }
                icon={
                  <YStack
                    width={32}
                    height={32}
                    rounded="$2"
                    bg="$color5"
                    items="center"
                    justify="center"
                  >
                    <SizableText size="$2" fontWeight="700" color="$color11">
                      {provider.name.charAt(0).toUpperCase()}
                    </SizableText>
                  </YStack>
                }
              />
            ))}
          </YStack>
        </YStack>
      )}
      <CreateProviderDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        onSubmit={handleCreateProvider}
      />
    </YStack>
  )
})

export default ProviderListPage
