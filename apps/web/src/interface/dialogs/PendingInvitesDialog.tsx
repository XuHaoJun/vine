import { memo } from 'react'
import { ScrollView, Sheet, SizableText, YStack, XStack } from 'tamagui'

import { useAuth } from '~/features/auth/client/authClient'
import { Avatar } from '~/interface/avatars/Avatar'
import { Button } from '~/interface/buttons/Button'
import { showToast } from '~/interface/toast/Toast'
import { zero, useZeroQuery } from '~/zero/client'
import { pendingInvitesByUserId } from '@vine/zero-schema/queries/chat'

type PendingInvitesDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export const PendingInvitesDialog = memo(
  ({ open, onOpenChange }: PendingInvitesDialogProps) => {
    const { user } = useAuth()

    const [pendingInvites] = useZeroQuery(
      pendingInvitesByUserId,
      { userId: user?.id ?? '' },
      { enabled: Boolean(user?.id) },
    )

    const handleAccept = async (chatId: string) => {
      try {
        await zero.mutate.chatMember.acceptInvite({ chatId })
        showToast('已接受邀請', { type: 'success' })
      } catch (e: any) {
        showToast(`接受失敗: ${e.message}`, { type: 'error' })
      }
    }

    const handleDecline = async (chatId: string) => {
      try {
        await zero.mutate.chatMember.declineInvite({ chatId })
        showToast('已拒絕邀請', { type: 'info' })
      } catch (e: any) {
        showToast(`拒絕失敗: ${e.message}`, { type: 'error' })
      }
    }

    return (
      <Sheet modal open={open} onOpenChange={onOpenChange} snapPoints={[80]}>
        <Sheet.Overlay
          opacity={0.5}
          enterStyle={{ opacity: 0 }}
          exitStyle={{ opacity: 0 }}
        />
        <Sheet.Frame flex={1} bg="$background">
          <YStack flex={1}>
            <XStack
              px="$3"
              py="$3"
              items="center"
              justify="space-between"
              borderBottomWidth={1}
              borderBottomColor="$color4"
            >
              <SizableText size="$6" fontWeight="700">
                待處理邀請
              </SizableText>
              <Button variant="transparent" onPress={() => onOpenChange(false)}>
                ✕
              </Button>
            </XStack>

            <ScrollView flex={1}>
              {pendingInvites && pendingInvites.length > 0 ? (
                <YStack px="$3" py="$2" gap="$2">
                  {pendingInvites.map((invite) => (
                    <XStack
                      key={invite.chatId}
                      py="$3"
                      items="center"
                      gap="$3"
                      borderBottomWidth={1}
                      borderBottomColor="$color4"
                    >
                      <Avatar
                        size={48}
                        image={invite.chat?.image ?? null}
                        name={invite.chat?.name ?? '群組'}
                      />
                      <YStack flex={1}>
                        <SizableText size="$4" fontWeight="600">
                          {invite.chat?.name ?? '未知群組'}
                        </SizableText>
                        <SizableText size="$2" color="$color10">
                          邀請你加入群組
                        </SizableText>
                      </YStack>
                      <XStack gap="$2">
                        <Button
                          size="$2"
                          theme="accent"
                          onPress={() => handleAccept(invite.chatId)}
                        >
                          接受
                        </Button>
                        <Button
                          size="$2"
                          variant="outlined"
                          onPress={() => handleDecline(invite.chatId)}
                        >
                          拒絕
                        </Button>
                      </XStack>
                    </XStack>
                  ))}
                </YStack>
              ) : (
                <YStack flex={1} items="center" justify="center" py="$8">
                  <SizableText size="$4" color="$color10">
                    沒有待處理的邀請
                  </SizableText>
                </YStack>
              )}
            </ScrollView>
          </YStack>
        </Sheet.Frame>
      </Sheet>
    )
  },
)
