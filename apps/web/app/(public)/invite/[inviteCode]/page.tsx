import { createRoute, useActiveParams, router } from 'one'
import { memo, useState } from 'react'
import { SizableText, YStack } from 'tamagui'

import { useAuth } from '~/features/auth/client/authClient'
import { Avatar } from '~/interface/avatars/Avatar'
import { Button } from '~/interface/buttons/Button'
import { showToast } from '~/interface/toast/Toast'
import { zero } from '~/zero/client'
import { useZeroQuery } from '~/zero/client'
import { chatsByUserId } from '@vine/zero-schema/queries/chat'

const route = createRoute<'/(public)/invite/[inviteCode]'>()

export const InvitePage = memo(() => {
  const { inviteCode } = useActiveParams<{ inviteCode: string }>()
  const { user } = useAuth()
  const [joining, setJoining] = useState(false)

  const [allChats] = useZeroQuery(
    chatsByUserId,
    { userId: user?.id ?? '' },
    { enabled: Boolean(user?.id) },
  )

  const myChats = allChats ?? []
  const existingChat = myChats.find((c) => c.inviteCode === inviteCode)

  const handleJoin = async () => {
    if (!user) {
      router.push(`/auth/login?redirect=/invite/${inviteCode}` as any)
      return
    }

    if (existingChat) {
      router.push(`/home/talks/${existingChat.id}` as any)
      return
    }

    setJoining(true)
    try {
      await zero.mutate.chatMember.joinViaInvite({
        inviteCode: inviteCode!,
        createdAt: Date.now(),
      })

      showToast('已加入群組', { type: 'success' })
      router.push('/home/talks' as any)
    } catch (e: any) {
      showToast(`加入失敗: ${e.message}`, { type: 'error' })
    } finally {
      setJoining(false)
    }
  }

  return (
    <YStack flex={1} items="center" justify="center" bg="$background" px="$6">
      <YStack items="center" gap="$4" maxW={400}>
        <Avatar size={80} image={null} name="Group" />
        <SizableText size="$8" fontWeight="700">邀請加入群組</SizableText>
        <SizableText size="$3" color="$color10" text="center">
          {user
            ? existingChat
              ? '你已經在這個群組中了'
              : '點擊下方按鈕加入此群組'
            : '請先登入帳號以加入群組'}
        </SizableText>

        <Button
          onPress={handleJoin}
          disabled={joining}
          width="100%"
        >
          {joining ? '加入中...' : user ? (existingChat ? '進入群組' : '加入群組') : '登入以加入'}
        </Button>
      </YStack>
    </YStack>
  )
})

export default InvitePage