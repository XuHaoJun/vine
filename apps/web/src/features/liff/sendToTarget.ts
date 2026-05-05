export type ShareTargetItem = {
  id: string
  kind: 'friend' | 'chat' | 'group'
  name: string
  image: string | null | undefined
  chatId?: string
  userId?: string
  memberCount?: number
}

export type ConvertedMessage = {
  type: string
  text?: string | null
  metadata?: string | null
}

export async function sendToTarget(
  zero: {
    mutate: {
      chat: { findOrCreateDirectChat: (args: any) => any }
      message: { sendLiff: (args: any) => void }
    }
  },
  target: ShareTargetItem,
  messages: ConvertedMessage[],
  now: number,
) {
  let chatId = target.chatId

  if (target.kind === 'friend' && target.userId && !chatId) {
    const newChatId = crypto.randomUUID()
    await zero.mutate.chat.findOrCreateDirectChat({
      friendUserId: target.userId,
      chatId: newChatId,
      member1Id: crypto.randomUUID(),
      member2Id: crypto.randomUUID(),
    })
    chatId = newChatId
  }

  if (!chatId) return

  for (let i = 0; i < messages.length; i++) {
    const converted = messages[i]!
    zero.mutate.message.sendLiff({
      id: crypto.randomUUID(),
      chatId,
      senderId: undefined,
      senderType: 'user',
      type: converted.type,
      text: converted.text ?? undefined,
      metadata: converted.metadata ?? undefined,
      createdAt: now + i,
    })
  }
}
