import { Dialog, XStack, YStack, SizableText } from 'tamagui'

import { Button } from '~/interface/buttons/Button'
import { showError } from '~/interface/dialogs/actions'
import { showToast } from '~/interface/toast/Toast'
import { useAuth } from '~/features/auth/client/authClient'
import { oaClient } from '~/features/oa/client'
import { FLEX_SIMULATOR_OA_UNIQUE_ID } from '~/features/oa/constants'
import { useTanMutation, useTanQuery, useTanQueryClient } from '~/query'
import type { OADetailData } from '~/interface/dialogs/OADetailSheet'

type FlexSimulatorSendDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  flexJson: string
  openOADetail: (oa: OADetailData) => void
}

export function FlexSimulatorSendDialog({
  open,
  onOpenChange,
  flexJson,
  openOADetail,
}: FlexSimulatorSendDialogProps) {
  const { user } = useAuth()
  const queryClient = useTanQueryClient()

  const { data: oaData } = useTanQuery({
    queryKey: ['oa', 'resolve', FLEX_SIMULATOR_OA_UNIQUE_ID],
    queryFn: () => oaClient.resolveOfficialAccount({ uniqueId: FLEX_SIMULATOR_OA_UNIQUE_ID }),
    enabled: open,
  })

  const flexSimOA = oaData?.account

  const { data: isFriendData } = useTanQuery({
    queryKey: ['oa', 'isFriend', flexSimOA?.id],
    queryFn: () => oaClient.isOAFriend({ officialAccountId: flexSimOA!.id }),
    enabled: open && !!flexSimOA?.id,
  })

  const isFriend = isFriendData?.isFriend ?? false

  const addFriend = useTanMutation({
    mutationFn: () => oaClient.addOAFriend({ officialAccountId: flexSimOA!.id }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['oa', 'isFriend', flexSimOA?.id] })
      queryClient.invalidateQueries({ queryKey: ['oa', 'myFriends'] })
      showToast('已加入好友', { type: 'success' })
    },
    onError: () => {
      showToast('加入好友失敗', { type: 'error' })
    },
  })

  const sendFlexMessage = useTanMutation({
    mutationFn: () => oaClient.simulatorSendFlexMessage({ flexJson }),
    onSuccess: () => {
      onOpenChange(false)
      showToast('已送出', { type: 'success' })
    },
    onError: (error) => {
      showError(error, '傳送失敗')
    },
  })

  return (
    <Dialog modal open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay
          key="overlay"
          transition="quick"
          opacity={0.5}
          enterStyle={{ opacity: 0 }}
          exitStyle={{ opacity: 0 }}
        />
        <Dialog.Content
          bordered
          elevate
          key="content"
          transition={['quick', { opacity: { overshootClamping: true } }]}
          enterStyle={{ x: 0, y: -20, opacity: 0, scale: 0.9 }}
          exitStyle={{ x: 0, y: 10, opacity: 0, scale: 0.95 }}
          x={0}
          scale={1}
          opacity={1}
          y={0}
          gap="$4"
          p="$5"
        >
          <Dialog.Title size="$6">Send Message</Dialog.Title>

          <YStack gap="$2">
            <SizableText size="$3" color="$color11">
              Destination:
            </SizableText>
            <XStack
              borderWidth={1}
              borderColor="$borderColor"
              p="$3"
              gap="$3"
              items="center"
              style={{ borderRadius: 8 }}
            >
              <YStack
                width={18}
                height={18}
                borderWidth={2}
                borderColor="$blue9"
                items="center"
                justify="center"
                style={{ borderRadius: 9 }}
              >
                <YStack width={8} height={8} bg="$blue9" style={{ borderRadius: 4 }} />
              </YStack>
              <YStack
                width={40}
                height={40}
                bg="$color5"
                items="center"
                justify="center"
                style={{ borderRadius: 20 }}
              >
                <SizableText size="$4" color="$color11" fontWeight="600">
                  {user?.name?.[0]?.toUpperCase() ?? 'U'}
                </SizableText>
              </YStack>
              <SizableText size="$4" color="$color12">
                {user?.name ?? ''}
              </SizableText>
            </XStack>
          </YStack>

          {flexSimOA && (
            <XStack
              borderTopWidth={1}
              borderColor="$borderColor"
              pt="$3"
              gap="$3"
              items="center"
              justify="space-between"
              flexWrap="wrap"
            >
              <XStack gap="$3" items="center">
                <YStack
                  width={40}
                  height={40}
                  bg="$color4"
                  items="center"
                  justify="center"
                  style={{ borderRadius: 20 }}
                >
                  <SizableText size="$3" color="$color10">
                    {flexSimOA.name[0]}
                  </SizableText>
                </YStack>
                <SizableText size="$3" color="$color11">
                  {flexSimOA.name}
                </SizableText>
              </XStack>
              <XStack gap="$2">
                <Button
                  size="$2"
                  variant="outlined"
                  onPress={() =>
                    openOADetail({
                      id: flexSimOA.id,
                      name: flexSimOA.name,
                      oaId: flexSimOA.uniqueId,
                      imageUrl: flexSimOA.imageUrl || undefined,
                    })
                  }
                >
                  查看官方帳號
                </Button>
                {isFriend ? (
                  <Button size="$2" variant="outlined" disabled>
                    已加好友
                  </Button>
                ) : (
                  <Button
                    size="$2"
                    onPress={() => addFriend.mutate()}
                    disabled={addFriend.isPending}
                  >
                    加入好友
                  </Button>
                )}
              </XStack>
            </XStack>
          )}

          <XStack gap="$3" justify="flex-end" pt="$2">
            <Dialog.Close asChild>
              <Button size="$3" variant="outlined">
                Cancel
              </Button>
            </Dialog.Close>
            <Button
              size="$3"
              onPress={() => sendFlexMessage.mutate()}
              disabled={sendFlexMessage.isPending}
            >
              Send
            </Button>
          </XStack>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog>
  )
}