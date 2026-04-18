import { useState } from 'react'
import { Sheet, SizableText, YStack, XStack, ScrollView } from 'tamagui'

import { Avatar } from '~/interface/avatars/Avatar'
import { Button } from '~/interface/buttons/Button'
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
}

export function GroupInfoSheet({
  chatId,
  groupName,
  groupImage,
  myRole,
  open,
  onOpenChange,
}: GroupInfoSheetProps) {
  const [showInviteDialog, setShowInviteDialog] = useState(false)
  const [showAddMembersDialog, setShowAddMembersDialog] = useState(false)

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
            </YStack>

            <YStack px="$4" gap="$2">
              {(myRole === 'owner' || myRole === 'admin') && (
                <>
                  <Button onPress={() => setShowInviteDialog(true)}>邀請連結</Button>
                  <Button onPress={() => setShowAddMembersDialog(true)}>新增成員</Button>
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
                  {(myRole === 'owner' || myRole === 'admin') && m.role !== 'owner' && (
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
    </>
  )
}
