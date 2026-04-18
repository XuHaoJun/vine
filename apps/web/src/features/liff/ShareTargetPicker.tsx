import { memo, useMemo, useState } from 'react'
import { SizableText, XStack, YStack, ScrollView, Circle, Spinner } from 'tamagui'

import { Avatar } from '~/interface/avatars/Avatar'
import { CaretLeftIcon } from '~/interface/icons/phosphor/CaretLeftIcon'
import { useShareTargets } from '~/features/liff/useShareTargets'
import { useAuth } from '~/features/auth/client/authClient'
import { zero } from '~/zero/client'

type ShareTargetItem = {
  id: string
  kind: 'friend' | 'chat'
  name: string
  image: string | null | undefined
  chatId?: string
  userId?: string
}

type ShareTargetPickerProps = {
  messages: { type: string; text?: string }[]
  isMultiple: boolean
  onDone: (result: { status: 'sent' } | false) => void
}

function CollapsibleSection({
  title,
  count,
  expanded,
  onToggle,
  children,
}: {
  title: string
  count: number
  expanded: boolean
  onToggle: () => void
  children: React.ReactNode
}) {
  return (
    <YStack>
      <XStack
        items="center"
        justify="space-between"
        px="$4"
        py="$3"
        cursor="pointer"
        onPress={onToggle}
      >
        <SizableText size="$3" fontWeight="600" color="$color12">
          {title} {count}
        </SizableText>
        <YStack cursor="pointer" onPress={onToggle}>
          <SizableText size="$3" color="$color10">
            {expanded ? '▲' : '▼'}
          </SizableText>
        </YStack>
      </XStack>
      {expanded && children}
    </YStack>
  )
}

function TargetItem({
  item,
  selected,
  onSelect,
}: {
  item: ShareTargetItem
  selected: boolean
  onSelect: () => void
}) {
  return (
    <XStack items="center" gap="$3" px="$4" py="$2.5" cursor="pointer" onPress={onSelect}>
      <Circle
        size={22}
        borderWidth={2}
        borderColor={selected ? '$green9' : '$color6'}
        bg={selected ? '$green9' : 'transparent'}
        items="center"
        justify="center"
      >
        {selected && <Circle size={8} bg="white" />}
      </Circle>
      <Avatar size={40} image={item.image} name={item.name} />
      <SizableText size="$3" color="$color12" flex={1} numberOfLines={1}>
        {item.name}
      </SizableText>
    </XStack>
  )
}

export const ShareTargetPicker = memo(
  ({ messages, isMultiple, onDone }: ShareTargetPickerProps) => {
    const { user } = useAuth()
    const userId = user?.id ?? ''
    const { chats, isLoading } = useShareTargets()
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
    const [chatsExpanded, setChatsExpanded] = useState(true)

    const allTargets = useMemo<ShareTargetItem[]>(() => {
      const items: ShareTargetItem[] = []
      for (const c of chats) {
        items.push({
          id: `chat-${c.chatId}`,
          kind: 'chat',
          name: c.name,
          image: c.image,
          chatId: c.chatId,
        })
      }
      return items
    }, [chats])

    const handleSelect = (id: string) => {
      setSelectedIds((prev) => {
        const next = new Set(prev)
        if (isMultiple) {
          if (next.has(id)) {
            next.delete(id)
          } else {
            next.add(id)
          }
        } else {
          if (next.has(id)) {
            next.clear()
          } else {
            next.clear()
            next.add(id)
          }
        }
        return next
      })
    }

    const handleShare = async () => {
      if (selectedIds.size === 0) return

      const targets = allTargets.filter((t) => selectedIds.has(t.id))
      const textMessages = messages.filter((m) => m.type === 'text')

      try {
        for (const target of targets) {
          if (target.kind === 'friend') {
            continue
          }
          if (target.kind === 'chat' && target.chatId) {
            for (const msg of textMessages) {
              zero.mutate.message.send({
                id: crypto.randomUUID(),
                chatId: target.chatId,
                senderId: userId,
                senderType: 'user',
                type: 'text',
                text: msg.text ?? '',
                createdAt: Date.now(),
              })
            }
          }
        }
        onDone({ status: 'sent' })
      } catch {
        onDone(false)
      }
    }

    const handleCancel = () => {
      onDone(false)
    }

    const hasAnySelection = selectedIds.size > 0

    return (
      <YStack flex={1} bg="$background" position="absolute" inset={0} z={1000}>
        {/* Header */}
        <XStack
          items="center"
          justify="space-between"
          px="$4"
          py="$3"
          borderBottomWidth={1}
          borderColor="$borderColor"
        >
          <XStack flex={1} items="center" justify="center">
            <SizableText size="$5" fontWeight="700" color="$color12">
              選擇傳送對象
            </SizableText>
          </XStack>
          <XStack position="absolute" l="$4" cursor="pointer" onPress={handleCancel}>
            <CaretLeftIcon size={24} color="$color12" />
          </XStack>
        </XStack>

        {/* Content */}
        {isLoading ? (
          <YStack flex={1} items="center" justify="center">
            <Spinner size="large" />
          </YStack>
        ) : (
          <ScrollView flex={1}>
            {/* Chats section */}
            <CollapsibleSection
              title="聊天"
              count={chats.length}
              expanded={chatsExpanded}
              onToggle={() => setChatsExpanded((v) => !v)}
            >
              {chats.map((c) => (
                <TargetItem
                  key={`chat-${c.chatId}`}
                  item={{
                    id: `chat-${c.chatId}`,
                    kind: 'chat',
                    name: c.name,
                    image: c.image,
                    chatId: c.chatId,
                  }}
                  selected={selectedIds.has(`chat-${c.chatId}`)}
                  onSelect={() => handleSelect(`chat-${c.chatId}`)}
                />
              ))}
              {chats.length === 0 && (
                <YStack px="$4" py="$6" items="center">
                  <SizableText size="$3" color="$color10">
                    沒有聊天
                  </SizableText>
                </YStack>
              )}
            </CollapsibleSection>
          </ScrollView>
        )}

        {/* Bottom bar */}
        <XStack
          px="$4"
          py="$3"
          borderTopWidth={1}
          borderColor="$borderColor"
          bg="$background"
        >
          <YStack
            flex={1}
            bg={hasAnySelection ? '$green9' : '$color5'}
            rounded="$3"
            items="center"
            justify="center"
            py="$3"
            cursor={hasAnySelection ? 'pointer' : 'default'}
            onPress={hasAnySelection ? handleShare : undefined}
          >
            <SizableText
              size="$4"
              fontWeight="700"
              color={hasAnySelection ? 'white' : '$color10'}
            >
              分享
            </SizableText>
          </YStack>
        </XStack>
      </YStack>
    )
  },
)
