import { useState } from 'react'
import { H3, Separator, Sheet, XStack, YStack } from 'tamagui'

import { Button } from '~/interface/buttons/Button'
import { ArrowUpRightIcon } from '~/interface/icons/phosphor/ArrowUpRightIcon'
import { CopyIcon } from '~/interface/icons/phosphor/CopyIcon'
import { ListIcon } from '~/interface/icons/phosphor/ListIcon'
import { ChatCircleIcon } from '~/interface/icons/phosphor/ChatCircleIcon'
import { showToast } from '~/interface/toast/Toast'

type Props = {
  miniApp: { id: string; name: string }
  permanentLink: string
  onShareToChat: () => void
}

export function MiniAppActionMenu({ miniApp: _miniApp, permanentLink, onShareToChat }: Props) {
  const [open, setOpen] = useState(false)

  const handleShareToChat = () => {
    setOpen(false)
    onShareToChat()
  }

  const handleCopyUrl = async () => {
    await navigator.clipboard.writeText(permanentLink)
    setOpen(false)
    showToast('Link copied', { type: 'success' })
  }

  const handleOpenExternal = () => {
    window.open(permanentLink, '_blank', 'noopener,noreferrer')
    setOpen(false)
  }

  return (
    <>
      <Button
        variant="transparent"
        circular
        icon={<ListIcon size="$1" />}
        aria-label="Mini app actions"
        onPress={() => setOpen(true)}
      />
      <Sheet
        open={open}
        onOpenChange={setOpen}
        transition="medium"
        modal
        dismissOnSnapToBottom
        snapPoints={[35]}
      >
        <Sheet.Overlay
          bg="$shadow6"
          transition="quick"
          enterStyle={{ opacity: 0 }}
          exitStyle={{ opacity: 0 }}
        />
        <Sheet.Frame bg="$color2" boxShadow="0 0 10px $shadow4">
          <YStack flex={1} gap="$1" p="$3">
            <XStack
              p="$3"
              rounded="$4"
              gap="$3"
              items="center"
              hoverStyle={{ bg: '$color3' }}
              pressStyle={{ bg: '$color4' }}
              cursor="pointer"
              onPress={handleShareToChat}
            >
              <ChatCircleIcon />
              <H3 size="$3">Share to chat</H3>
            </XStack>

            <Separator />

            <XStack
              p="$3"
              rounded="$4"
              gap="$3"
              items="center"
              hoverStyle={{ bg: '$color3' }}
              pressStyle={{ bg: '$color4' }}
              cursor="pointer"
              onPress={() => void handleCopyUrl()}
            >
              <CopyIcon />
              <H3 size="$3">Copy URL</H3>
            </XStack>

            <Separator />

            <XStack
              p="$3"
              rounded="$4"
              gap="$3"
              items="center"
              hoverStyle={{ bg: '$color3' }}
              pressStyle={{ bg: '$color4' }}
              cursor="pointer"
              onPress={handleOpenExternal}
            >
              <ArrowUpRightIcon />
              <H3 size="$3">Open in external browser</H3>
            </XStack>
          </YStack>
        </Sheet.Frame>
      </Sheet>
    </>
  )
}
