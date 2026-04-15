import { useRouter } from 'one'
import { memo, useState } from 'react'
import { SizableText, Spinner, XStack, YStack } from 'tamagui'

import { oaClient } from '~/features/oa/client'
import { Button } from '~/interface/buttons/Button'
import { Pressable } from '~/interface/buttons/Pressable'
import { Input } from '~/interface/forms/Input'
import { showToast } from '~/interface/toast/Toast'
import { dialogConfirm, showError } from '~/interface/dialogs/actions'
import { useTanMutation, useTanQuery, useTanQueryClient } from '~/query'

export const ManagerIndexPage = memo(() => {
  const router = useRouter()
  const [search, setSearch] = useState('')
  const qc = useTanQueryClient()

  const { data, isLoading } = useTanQuery({
    queryKey: ['oa', 'my-accounts'],
    queryFn: () => oaClient.listMyOfficialAccounts({}),
  })

  const deleteMutation = useTanMutation({
    mutationFn: (id: string) => oaClient.deleteOfficialAccount({ id }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['oa', 'my-accounts'] })
      showToast('Account deleted', { type: 'success' })
    },
    onError: (e) => showError(e, 'Failed to delete account'),
  })

  const handleDelete = async (id: string, name: string) => {
    const confirmed = await dialogConfirm({
      title: `Delete "${name}"?`,
      description: 'This cannot be undone.',
    })
    if (confirmed) deleteMutation.mutate(id)
  }

  const accounts = data?.accounts ?? []
  const filtered = accounts.filter(
    (a) =>
      a.name.toLowerCase().includes(search.toLowerCase()) ||
      a.uniqueId.toLowerCase().includes(search.toLowerCase()),
  )

  return (
    <YStack flex={1} bg="$background" $platform-web={{ height: '100vh', minHeight: '100vh' }}>
      {/* Header */}
      <XStack
        height="$6"
        px="$5"
        shrink={0}
        items="center"
        justify="space-between"
        bg="$background"
        borderBottomWidth={1}
        borderColor="$borderColor"
      >
        <SizableText size="$4" fontWeight="700" color="$color12">
          LINE Official Account Manager
        </SizableText>
      </XStack>

      {/* Content */}
      <XStack flex={1} style={{ minHeight: 0 }} $platform-web={{ overflow: 'hidden' }}>
        {/* Sidebar */}
        <YStack
          width={200}
          shrink={0}
          bg="$background"
          borderRightWidth={1}
          borderColor="$borderColor"
          $platform-web={{ overflowY: 'auto' }}
          p="$3"
          gap="$4"
        >
          <YStack gap="$1">
            <SizableText size="$1" fontWeight="700" color="$color9" textTransform="uppercase">
              Menu
            </SizableText>
            <Pressable py="$2" px="$3" rounded="$3" bg="$color3">
              <SizableText size="$2" fontWeight="700" color="$color12">
                Accounts
              </SizableText>
            </Pressable>
          </YStack>
        </YStack>

        {/* Main content */}
        <YStack flex={1} style={{ minHeight: 0 }} $platform-web={{ overflowY: 'auto' }}>
          <YStack p="$6" maxW={1120} width="100%" mx="auto" gap="$6">
            {/* Page header */}
            <XStack justify="space-between" items="center">
              <YStack gap="$1">
                <SizableText size="$7" fontWeight="700" color="$color12">
                  Accounts
                </SizableText>
                <SizableText size="$2" color="$color10">
                  Manage your LINE Official Accounts
                </SizableText>
              </YStack>
              <Button onPress={() => router.push('/manager/create' as never)}>
                + Create new
              </Button>
            </XStack>

            {/* Search */}
            <XStack gap="$3" items="center">
              <YStack flex={1}>
                <Input
                  value={search}
                  onChangeText={setSearch}
                  placeholder="Account name..."
                />
              </YStack>
            </XStack>

            {/* Account list */}
            {isLoading ? (
              <YStack items="center" py="$10">
                <Spinner size="large" />
              </YStack>
            ) : filtered.length === 0 ? (
              <YStack
                py="$10"
                items="center"
                gap="$3"
                borderWidth={1}
                borderColor="$borderColor"
                rounded="$4"
              >
                <SizableText size="$4" color="$color11" fontWeight="600">
                  {search ? 'No accounts found' : 'No accounts yet'}
                </SizableText>
                <SizableText size="$2" color="$color10">
                  {search
                    ? 'Try a different search term'
                    : 'Create your first LINE Official Account to get started'}
                </SizableText>
                {!search && (
                  <Button
                    mt="$2"
                    onPress={() => router.push('/manager/create' as never)}
                  >
                    Create new account
                  </Button>
                )}
              </YStack>
            ) : (
              <YStack>
                <SizableText size="$1" fontWeight="600" color="$color10" mb="$2">
                  Accounts ({filtered.length})
                </SizableText>
                {/* Table header */}
                <XStack
                  px="$4"
                  py="$2"
                  bg="$color2"
                  borderTopWidth={1}
                  borderLeftWidth={1}
                  borderRightWidth={1}
                  borderColor="$borderColor"
                  rounded="$2"
                  $platform-web={{
                    borderBottomLeftRadius: 0,
                    borderBottomRightRadius: 0,
                  }}
                >
                  <YStack flex={2}>
                    <SizableText size="$1" fontWeight="700" color="$color10">
                      Account name
                    </SizableText>
                  </YStack>
                  <YStack flex={2}>
                    <SizableText size="$1" fontWeight="700" color="$color10">
                      Unique ID
                    </SizableText>
                  </YStack>
                  <YStack flex={1}>
                    <SizableText size="$1" fontWeight="700" color="$color10">
                      Status
                    </SizableText>
                  </YStack>
                  <YStack width={160} />
                </XStack>
                {/* Table rows */}
                <YStack
                  borderWidth={1}
                  borderColor="$borderColor"
                  rounded="$2"
                  $platform-web={{
                    borderTopLeftRadius: 0,
                    borderTopRightRadius: 0,
                  }}
                  overflow="hidden"
                >
                  {filtered.map((account, i) => (
                    <XStack
                      key={account.id}
                      px="$4"
                      py="$3"
                      items="center"
                      borderBottomWidth={i < filtered.length - 1 ? 1 : 0}
                      borderColor="$borderColor"
                      hoverStyle={{ bg: '$backgroundHover' }}
                    >
                      <YStack flex={2}>
                        <SizableText size="$3" fontWeight="600" color="$color12">
                          {account.name}
                        </SizableText>
                      </YStack>
                      <YStack flex={2}>
                        <SizableText size="$2" color="$color10">
                          @{account.uniqueId}
                        </SizableText>
                      </YStack>
                      <YStack flex={1}>
                        <XStack
                          px="$2"
                          py="$1"
                          rounded="$2"
                          bg={
                            account.status === 1
                              ? '$green3'
                              : account.status === 2
                                ? '$red3'
                                : '$color3'
                          }
                          self="flex-start"
                        >
                          <SizableText
                            size="$1"
                            fontWeight="700"
                            color={
                              account.status === 1
                                ? '$green10'
                                : account.status === 2
                                  ? '$red10'
                                  : '$color10'
                            }
                          >
                            {account.status === 1
                              ? 'Active'
                              : account.status === 2
                                ? 'Disabled'
                                : 'Unknown'}
                          </SizableText>
                        </XStack>
                      </YStack>
                      <XStack width={160} gap="$2" justify="flex-end">
                        <Button
                          size="$2"
                          onPress={() =>
                            router.push(`/manager/${account.id}/richmenu` as never)
                          }
                        >
                          Manage
                        </Button>
                        <Button
                          size="$2"
                          variant="outlined"
                          theme="red"
                          onPress={() => handleDelete(account.id, account.name)}
                        >
                          Delete
                        </Button>
                      </XStack>
                    </XStack>
                  ))}
                </YStack>
              </YStack>
            )}
          </YStack>
        </YStack>
      </XStack>
    </YStack>
  )
})

export default ManagerIndexPage
