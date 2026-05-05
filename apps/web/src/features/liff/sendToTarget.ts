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
  text?: string
  metadata?: string
}

export async function sendToTarget(
  zero: {
    mutate: {
      chat: { findOrCreateDirectChat: (args: any) => Promise<{ chatId: string }> }
      message: { sendLiff: (args: any) => void }
    }
  },
  target: ShareTargetItem,
  messages: ConvertedMessage[],
  now: number,
) {
  let chatId = target.chatId

  if (target.kind === 'friend' && target.userId) {
    const result = await zero.mutate.chat.findOrCreateDirectChat({
      friendUserId: target.userId,
      chatId: crypto.randomUUID(),
      member1Id: crypto.randomUUID(),
      member2Id: crypto.randomUUID(),
    })
    chatId = result.chatId
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
