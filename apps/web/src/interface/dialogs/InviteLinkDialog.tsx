import { useState, useEffect, useCallback } from 'react'
import { Sheet, SizableText, YStack, XStack } from 'tamagui'

import { Button } from '~/interface/buttons/Button'
import { showToast } from '~/interface/toast/Toast'
import { zero, getQuery } from '~/zero/client'
import { chatById } from '@vine/zero-schema/queries/chat'
import type { Chat } from '@vine/zero-schema/models/chat'

type InviteLinkDialogProps = {
  chatId: string
  open: boolean
  onOpenChange: (open: boolean) => void
  role: 'owner' | 'admin' | 'member'
}

export function InviteLinkDialog({
  chatId,
  open,
  onOpenChange,
  role,
}: InviteLinkDialogProps) {
  const [inviteUrl, setInviteUrl] = useState<string | null>(null)

  const loadInviteUrl = useCallback(() => {
    const chatQuery = getQuery(chatById, { chatId })
    chatQuery.subscribe((chats: Chat[] | null) => {
      const chat = chats?.[0]
      if (chat?.inviteCode) {
        const baseUrl = typeof window !== 'undefined' ? window.location.origin : ''
        setInviteUrl(`${baseUrl}/invite/${chat.inviteCode}`)
      } else {
        setInviteUrl(null)
      }
    })
    return () => chatQuery.unsubscribe()
  }, [chatId])

  useEffect(() => {
    if (open) {
      const cleanup = loadInviteUrl()
      return cleanup
    }
  }, [open, loadInviteUrl])

  const handleGenerate = async () => {
    try {
      await zero.mutate.chat.generateInviteLink({ chatId })
    } catch (e: any) {
      showToast(`生成失敗: ${e.message}`, { type: 'error' })
    }
  }

  const handleRevoke = async () => {
    try {
      await zero.mutate.chat.revokeInviteLink({ chatId })
      setInviteUrl(null)
      showToast('連結已撤銷', { type: 'info' })
    } catch (e: any) {
      showToast(`撤銷失敗: ${e.message}`, { type: 'error' })
    }
  }

  const handleCopy = () => {
    if (inviteUrl) {
      navigator.clipboard.writeText(inviteUrl)
      showToast('已複製到剪貼簿', { type: 'success' })
    }
  }

  const handleShare = async () => {
    if (inviteUrl && navigator.share) {
      try {
        await navigator.share({ title: '加入群組', url: inviteUrl })
      } catch {}
    } else {
      handleCopy()
    }
  }

  return (
    <Sheet modal open={open} onOpenChange={onOpenChange} snapPoints={[50]}>
      <Sheet.Overlay
        opacity={0.5}
        enterStyle={{ opacity: 0 }}
        exitStyle={{ opacity: 0 }}
      />
      <Sheet.Frame bg="$background" p="$4">
        <SizableText size="$6" fontWeight="700" mb="$3">
          邀請連結
        </SizableText>

        {inviteUrl ? (
          <YStack gap="$3">
            <YStack bg="$color2" p="$3" rounded="$3">
              <SizableText size="$2" numberOfLines={1}>
                {inviteUrl}
              </SizableText>
            </YStack>
            <XStack gap="$2">
              <Button flex={1} onPress={handleCopy}>
                複製
              </Button>
              <Button flex={1} onPress={handleShare}>
                分享
              </Button>
            </XStack>
            {(role === 'owner' || role === 'admin') && (
              <Button onPress={handleRevoke}>撤銷連結</Button>
            )}
          </YStack>
        ) : (
          <YStack gap="$3" items="center">
            <SizableText size="$3" color="$color10">
              尚無邀請連結
            </SizableText>
            {(role === 'owner' || role === 'admin') && (
              <Button onPress={handleGenerate}>生成連結</Button>
            )}
          </YStack>
        )}
        <Button mt="$4" variant="transparent" onPress={() => onOpenChange(false)}>
          關閉
        </Button>
      </Sheet.Frame>
    </Sheet>
  )
}
