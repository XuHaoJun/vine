import { useState } from 'react'
import { Sheet, SizableText, YStack, XStack } from 'tamagui'
import { TouchableOpacity } from 'react-native'

import { FriendPicker } from '~/interface/friend-picker/FriendPicker'
import { Button } from '~/interface/buttons/Button'
import { Input } from '~/interface/forms/Input'
import { showToast } from '~/interface/toast/Toast'
import { zero } from '~/zero/client'

type CreateGroupDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: (chatId: string) => void
}

export function CreateGroupDialog({
  open,
  onOpenChange,
  onSuccess,
}: CreateGroupDialogProps) {
  const [groupName, setGroupName] = useState('')
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([])
  const [requireApproval, setRequireApproval] = useState(false)

  const handleCreate = async () => {
    if (!groupName.trim()) {
      showToast('請輸入群組名稱', { type: 'error' })
      return
    }
    if (selectedUserIds.length < 1) {
      showToast('請至少選擇一位成員', { type: 'error' })
      return
    }

    const chatId = crypto.randomUUID()
    const createdAt = Date.now()

    try {
      await zero.mutate.chat.createGroupChat({
        chatId,
        name: groupName.trim(),
        memberIds: selectedUserIds,
        requireApproval,
        createdAt,
      })

      showToast('群組已建立', { type: 'success' })
      onOpenChange(false)
      onSuccess?.(chatId)
    } catch (e: any) {
      showToast(`建立失敗: ${e.message}`, { type: 'error' })
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
              建立群組
            </SizableText>
            <Button variant="transparent" onPress={() => onOpenChange(false)}>
              ✕
            </Button>
          </XStack>

          <YStack px="$3" py="$2" gap="$2">
            <SizableText size="$3" fontWeight="600">
              群組名稱
            </SizableText>
            <Input
              placeholder="輸入群組名稱"
              value={groupName}
              onChangeText={setGroupName}
            />
          </YStack>

          <TouchableOpacity
            onPress={() => setRequireApproval(!requireApproval)}
            activeOpacity={0.7}
          >
            <XStack px="$3" py="$2" items="center" gap="$2">
              <SizableText
                size="$3"
                color={requireApproval ? '$color10' : '$color9'}
                fontWeight="500"
              >
                {requireApproval ? '☑' : '☐'}
              </SizableText>
              <SizableText size="$2" color="$color10" flex={1}>
                用戶收到邀請後就會加入群組。關閉此設定以要求成員加入前須接受邀請
              </SizableText>
            </XStack>
          </TouchableOpacity>

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
              onPress={handleCreate}
              disabled={selectedUserIds.length < 1 || !groupName.trim()}
            >
              建立群組
            </Button>
          </XStack>
        </YStack>
      </Sheet.Frame>
    </Sheet>
  )
}
