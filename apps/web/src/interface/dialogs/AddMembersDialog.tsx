import { useState } from 'react'
import { Sheet, SizableText, YStack, XStack } from 'tamagui'

import { FriendPicker } from '~/interface/friend-picker/FriendPicker'
import { Button } from '~/interface/buttons/Button'
import { showToast } from '~/interface/toast/Toast'
import { zero } from '~/zero/client'

type AddMembersDialogProps = {
  chatId: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function AddMembersDialog({ chatId, open, onOpenChange }: AddMembersDialogProps) {
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([])

  const handleAdd = async () => {
    if (selectedUserIds.length < 1) {
      showToast('請至少選擇一位成員', { type: 'error' })
      return
    }

    try {
      await zero.mutate.chatMember.addMembers({
        chatId,
        userIds: selectedUserIds,
        createdAt: Date.now(),
      })

      showToast('已新增成員', { type: 'success' })
      onOpenChange(false)
      setSelectedUserIds([])
    } catch (e: any) {
      showToast(`新增失敗: ${e.message}`, { type: 'error' })
    }
  }

  return (
    <Sheet modal open={open} onOpenChange={onOpenChange} snapPoints={[100]}>
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
              新增成員
            </SizableText>
            <Button variant="transparent" onPress={() => onOpenChange(false)}>
              ✕
            </Button>
          </XStack>

          <YStack flex={1} minH={0}>
            <FriendPicker
              selectedUserIds={selectedUserIds}
              onSelectionChange={setSelectedUserIds}
            />
          </YStack>

          <XStack px="$3" py="$3" borderTopWidth={1} borderTopColor="$color4">
            <Button
              flex={1}
              theme="accent"
              onPress={handleAdd}
              disabled={selectedUserIds.length < 1}
            >
              新增至群組
            </Button>
          </XStack>
        </YStack>
      </Sheet.Frame>
    </Sheet>
  )
}
