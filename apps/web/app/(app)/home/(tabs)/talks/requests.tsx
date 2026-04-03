import { router } from 'one'
import { memo, useState } from 'react'
import { ScrollView, SizableText, XStack, YStack } from 'tamagui'

import {
  usePendingRequests,
  useFriendshipActions,
  useUserSearch,
} from '~/features/chat/useFriendship'
import { useAuth } from '~/features/auth/client/authClient'
import { Avatar } from '~/interface/avatars/Avatar'
import { Button } from '~/interface/buttons/Button'
import { Input } from '~/interface/forms/Input'
import { H3 } from '~/interface/text/Headings'

export const RequestsPage = memo(() => {
  const { user } = useAuth()
  const userId = user?.id ?? ''
  const [searchQuery, setSearchQuery] = useState('')
  const [mode, setMode] = useState<'requests' | 'search'>('requests')

  const { received, sent } = usePendingRequests()
  const { acceptRequest, rejectRequest, sendRequest } = useFriendshipActions()
  const { users: searchResults } = useUserSearch(searchQuery)

  return (
    <YStack flex={1} bg="$background">
      <XStack px="$4" py="$3" items="center" gap="$3">
        <Button variant="transparent" onPress={() => router.back()} px="$2">
          ←
        </Button>
        <H3 flex={1}>好友管理</H3>
      </XStack>

      <XStack px="$3" pb="$2" gap="$2">
        <Button
          bg={mode === 'requests' ? '$color3' : undefined}
          variant={mode === 'requests' ? undefined : 'outlined'}
          onPress={() => setMode('requests')}
          px="$4"
          py="$1"
        >
          申請 {received.length > 0 ? `(${received.length})` : ''}
        </Button>
        <Button
          bg={mode === 'search' ? '$color3' : undefined}
          variant={mode === 'search' ? undefined : 'outlined'}
          onPress={() => setMode('search')}
          px="$4"
          py="$1"
        >
          搜尋新好友
        </Button>
      </XStack>

      <ScrollView flex={1}>
        {mode === 'search' ? (
          <YStack gap="$0">
            <XStack px="$3" py="$2">
              <Input
                flex={1}
                placeholder="輸入 username 搜尋"
                value={searchQuery}
                onChangeText={setSearchQuery}
                autoFocus
              />
            </XStack>
            {searchQuery.length >= 2 &&
              searchResults.map((u) => {
                if (u.id === userId) return null
                return (
                  <XStack key={u.id} px="$4" py="$3" gap="$3" items="center">
                    <Avatar size={48} image={u.image} name={u.name ?? u.username ?? ''} />
                    <YStack flex={1}>
                      <SizableText size="$4" fontWeight="600">
                        {u.name}
                      </SizableText>
                      <SizableText size="$3" color="$color10">
                        {u.username}
                      </SizableText>
                    </YStack>
                    <Button size="$3" onPress={() => sendRequest(u.id)}>
                      新增好友
                    </Button>
                  </XStack>
                )
              })}
            {searchQuery.length >= 2 && searchResults.length === 0 && (
              <YStack p="$6" items="center">
                <H3 color="$color9">找不到用戶</H3>
              </YStack>
            )}
          </YStack>
        ) : (
          <YStack gap="$0">
            {received.length > 0 && (
              <>
                <SizableText px="$4" py="$2" size="$3" fontWeight="600" color="$color10">
                  收到的申請
                </SizableText>
                {received.map((req) => {
                  const requester = req.requester
                  return (
                    <XStack key={req.id} px="$4" py="$3" gap="$3" items="center">
                      <Avatar
                        size={48}
                        image={requester?.image}
                        name={requester?.name ?? ''}
                      />
                      <YStack flex={1}>
                        <SizableText size="$4" fontWeight="600">
                          {requester?.name}
                        </SizableText>
                      </YStack>
                      <XStack gap="$2">
                        <Button
                          size="$3"
                          variant="outlined"
                          onPress={() => rejectRequest(req.id)}
                        >
                          拒絕
                        </Button>
                        <Button size="$3" onPress={() => acceptRequest(req)}>
                          同意
                        </Button>
                      </XStack>
                    </XStack>
                  )
                })}
              </>
            )}

            {sent.length > 0 && (
              <>
                <SizableText px="$4" py="$2" size="$3" fontWeight="600" color="$color10">
                  已送出
                </SizableText>
                {sent.map((req) => {
                  const addressee = req.addressee
                  return (
                    <XStack key={req.id} px="$4" py="$3" gap="$3" items="center">
                      <Avatar
                        size={48}
                        image={addressee?.image}
                        name={addressee?.name ?? ''}
                      />
                      <YStack flex={1}>
                        <SizableText size="$4" fontWeight="600">
                          {addressee?.name}
                        </SizableText>
                        <SizableText size="$2" color="$color9">
                          等待回應
                        </SizableText>
                      </YStack>
                    </XStack>
                  )
                })}
              </>
            )}

            {received.length === 0 && sent.length === 0 && (
              <YStack p="$6" items="center">
                <H3 color="$color9">目前沒有好友申請</H3>
              </YStack>
            )}
          </YStack>
        )}
      </ScrollView>
    </YStack>
  )
})

export default RequestsPage
