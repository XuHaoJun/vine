import { useState } from 'react'
import { Sheet, SizableText, YStack, XStack, ScrollView, Dialog } from 'tamagui'

import { useAuth } from '~/features/auth/client/authClient'
import { Avatar } from '~/interface/avatars/Avatar'
import { Button } from '~/interface/buttons/Button'
import { Input } from '~/interface/forms/Input'
import { showToast } from '~/interface/toast/Toast'
import { zero, useZeroQuery } from '~/zero/client'
import { groupMembersWithRoles } from '@vine/zero-schema/queries/chat'
import { InviteLinkDialog } from './InviteLinkDialog'
import { AddMembersDialog } from './AddMembersDialog'

type GroupInfoSheetProps = {
  chatId: string
  groupName: string
  groupImage: string | null
  myRole: 'owner' | 'admin' | 'member' | null
  open: boolean
  onOpenChange: (open: boolean) => void
  groupDescription?: string | null
  onUpdateDescription?: (description: string) => void
}

export function GroupInfoSheet({
  chatId,
  groupName,
  groupImage,
  myRole,
  open,
  onOpenChange,
  groupDescription,
  onUpdateDescription,
}: GroupInfoSheetProps) {
  const [showInviteDialog, setShowInviteDialog] = useState(false)
  const [showAddMembersDialog, setShowAddMembersDialog] = useState(false)
  const [showEditDescription, setShowEditDescription] = useState(false)
  const [showTransferOwnership, setShowTransferOwnership] = useState(false)
  const [editDescriptionValue, setEditDescriptionValue] = useState(groupDescription ?? '')
  const { user } = useAuth()
  const currentUserId = user?.id ?? ''

  const [members] = useZeroQuery(
    groupMembersWithRoles,
    { chatId },
    { enabled: Boolean(chatId) },
  )

  const handleLeave = async () => {
    try {
      await zero.mutate.chatMember.leaveGroup({ chatId })
      showToast('已離開群組', { type: 'success' })
      onOpenChange(false)
    } catch (e: any) {
      showToast(`離開失敗: ${e.message}`, { type: 'error' })
    }
  }

  const handleRemoveMember = async (targetUserId: string) => {
    try {
      await zero.mutate.chatMember.removeMember({ chatId, targetUserId })
      showToast('已移除成員', { type: 'success' })
    } catch (e: any) {
      showToast(`移除失敗: ${e.message}`, { type: 'error' })
    }
  }

  const handleSaveDescription = async () => {
    try {
      await zero.mutate.chat.updateGroupInfo({
        chatId,
        description: editDescriptionValue,
      })
      onUpdateDescription?.(editDescriptionValue)
      setShowEditDescription(false)
      showToast('已更新群組描述', { type: 'success' })
    } catch (e: any) {
      showToast(`更新失敗: ${e.message}`, { type: 'error' })
    }
  }

  const handleTransferOwnership = async (newOwnerId: string) => {
    try {
      await zero.mutate.chatMember.transferOwnership({
        chatId,
        newOwnerId,
      })
      setShowTransferOwnership(false)
      showToast('已轉讓群主', { type: 'success' })
      onOpenChange(false)
    } catch (e: any) {
      showToast(`轉讓失敗: ${e.message}`, { type: 'error' })
    }
  }

  return (
    <>
      <Sheet modal open={open} onOpenChange={onOpenChange} snapPoints={[80]}>
        <Sheet.Overlay
          opacity={0.5}
          enterStyle={{ opacity: 0 }}
          exitStyle={{ opacity: 0 }}
        />
        <Sheet.Frame flex={1} bg="$background">
          <XStack
            px="$3"
            py="$3"
            items="center"
            justify="space-between"
            borderBottomWidth={1}
            borderBottomColor="$color4"
          >
            <SizableText size="$6" fontWeight="700">
              群組資訊
            </SizableText>
            <Button variant="transparent" onPress={() => onOpenChange(false)}>
              ✕
            </Button>
          </XStack>

          <ScrollView flex={1}>
            <YStack px="$4" py="$4" items="center">
              <Avatar size={64} image={groupImage} name={groupName} />
              <SizableText size="$6" fontWeight="700" mt="$2">
                {groupName}
              </SizableText>
              <SizableText size="$2" color="$color10">
                {members?.length ?? 0} 位成員
              </SizableText>
              {groupDescription && (
                <SizableText size="$3" color="$color10" mt="$2" text="center">
                  {groupDescription}
                </SizableText>
              )}
            </YStack>

            <YStack px="$4" gap="$2">
              {(myRole === 'owner' || myRole === 'admin') && (
                <>
                  <Button onPress={() => setShowInviteDialog(true)}>邀請連結</Button>
                  <Button onPress={() => setShowAddMembersDialog(true)}>新增成員</Button>
                </>
              )}
              {myRole === 'owner' && (
                <>
                  <Button onPress={() => setShowEditDescription(true)}>
                    編輯群組描述
                  </Button>
                  <Button onPress={() => setShowTransferOwnership(true)}>轉讓群主</Button>
                </>
              )}
            </YStack>

            <YStack px="$4" py="$3">
              <SizableText size="$4" fontWeight="600" mb="$2">
                成員
              </SizableText>
              {members?.map((m) => (
                <XStack key={m.id} py="$2" items="center" gap="$3">
                  <Avatar
                    size={32}
                    image={m.user?.image ?? null}
                    name={m.user?.name ?? '?'}
                  />
                  <SizableText flex={1}>{m.user?.name ?? '未知'}</SizableText>
                  <SizableText size="$2" color="$color10">
                    {m.role === 'owner' ? '擁有者' : m.role === 'admin' ? '管理員' : ''}
                  </SizableText>
                  {(myRole === 'owner' || myRole === 'admin') &&
                    m.role !== 'owner' &&
                    m.userId !== currentUserId && (
                      <Button size="$1" onPress={() => handleRemoveMember(m.userId!)}>
                        移除
                      </Button>
                    )}
                </XStack>
              ))}
            </YStack>

            <YStack px="$4" py="$3">
              <Button onPress={handleLeave}>離開群組</Button>
            </YStack>
          </ScrollView>
        </Sheet.Frame>
      </Sheet>

      <InviteLinkDialog
        chatId={chatId}
        open={showInviteDialog}
        onOpenChange={setShowInviteDialog}
        role={myRole ?? 'member'}
      />

      {showAddMembersDialog && (
        <AddMembersDialog
          chatId={chatId}
          open={showAddMembersDialog}
          onOpenChange={setShowAddMembersDialog}
        />
      )}

      <Dialog modal open={showEditDescription} onOpenChange={setShowEditDescription}>
        <Dialog.Overlay opacity={0.5} />
        <Dialog.Content bg="$background" p="$4" bordered rounded="$4">
          <YStack gap="$3">
            <SizableText size="$5" fontWeight="700">
              編輯群組描述
            </SizableText>
            <Input
              placeholder="輸入群組描述"
              value={editDescriptionValue}
              onChangeText={setEditDescriptionValue}
              multiline
            />
            <XStack gap="$2" justify="flex-end">
              <Button variant="transparent" onPress={() => setShowEditDescription(false)}>
                取消
              </Button>
              <Button onPress={handleSaveDescription}>儲存</Button>
            </XStack>
          </YStack>
        </Dialog.Content>
      </Dialog>

      <Dialog modal open={showTransferOwnership} onOpenChange={setShowTransferOwnership}>
        <Dialog.Overlay opacity={0.5} />
        <Dialog.Content bg="$background" p="$4" bordered rounded="$4">
          <YStack gap="$3">
            <SizableText size="$5" fontWeight="700">
              轉讓群主
            </SizableText>
            <SizableText size="$3" color="$color10">
              選擇新群主後，你將會變成普通成員
            </SizableText>
            <ScrollView height={200}>
              <YStack gap="$2">
                {members
                  ?.filter((m) => m.role !== 'owner')
                  .map((m) => (
                    <Button
                      key={m.id}
                      onPress={() => handleTransferOwnership(m.userId!)}
                      variant="outlined"
                    >
                      {m.user?.name ?? '未知用戶'}
                    </Button>
                  ))}
              </YStack>
            </ScrollView>
            <Button variant="transparent" onPress={() => setShowTransferOwnership(false)}>
              取消
            </Button>
          </YStack>
        </Dialog.Content>
      </Dialog>
    </>
  )
}
