import { describe, expect, it, vi } from 'vitest'
import { mutate } from './message'

function makeTx(overrides: Record<string, any> = {}) {
  const inserted: any[] = []
  const chatUpdates: any[] = []
  return {
    inserted,
    chatUpdates,
    tx: {
      query: {
        chatMember: {
          where: vi.fn().mockReturnThis(),
          run: vi.fn().mockResolvedValue([]),
        },
        entitlement: {
          where: vi.fn().mockReturnThis(),
          run: vi.fn().mockResolvedValue([]),
        },
        ...overrides.query,
      },
      mutate: {
        message: {
          insert: vi.fn(async (msg: any) => {
            inserted.push(msg)
          }),
        },
        chat: {
          update: vi.fn(async (patch: any) => {
            chatUpdates.push(patch)
          }),
        },
        ...overrides.mutate,
      },
    },
  }
}

function userMessage(overrides: Record<string, any> = {}) {
  return {
    id: 'msg-1',
    chatId: 'chat-1',
    senderId: 'user-1',
    senderType: 'user',
    type: 'text',
    text: 'hello',
    createdAt: Date.now(),
    ...overrides,
  }
}

describe('message.sendLiff', () => {
  it('rejects unauthenticated callers', async () => {
    const { tx } = makeTx()
    await expect(
      mutate.sendLiff({ authData: undefined, tx } as any, userMessage()),
    ).rejects.toThrow('Unauthorized')
  })

  it('rejects user sender spoofing (senderId overwritten, fails membership)', async () => {
    const { tx } = makeTx()
    await expect(
      mutate.sendLiff(
        { authData: { id: 'attacker' }, tx } as any,
        userMessage({ senderId: 'victim' }),
      ),
    ).rejects.toThrow('Not a member')
  })

  it('rejects sends into chats where the caller is not a member', async () => {
    const { tx } = makeTx()
    await expect(
      mutate.sendLiff({ authData: { id: 'user-1' }, tx } as any, userMessage()),
    ).rejects.toThrow('Not a member')
  })

  it('allows non-sticker LIFF messages for a chat member', async () => {
    const { tx, inserted, chatUpdates } = makeTx({
      query: {
        chatMember: {
          where: vi.fn().mockReturnThis(),
          run: vi
            .fn()
            .mockResolvedValue([{ id: 'cm-1', userId: 'user-1', chatId: 'chat-1' }]),
        },
      },
    })
    const msg = userMessage()
    await mutate.sendLiff({ authData: { id: 'user-1' }, tx } as any, msg)
    expect(inserted).toHaveLength(1)
    expect(inserted[0].id).toBe('msg-1')
    expect(chatUpdates).toHaveLength(1)
    expect(chatUpdates[0].id).toBe('chat-1')
  })

  it('allows public/system sticker packages without entitlement', async () => {
    const { tx, inserted } = makeTx({
      query: {
        chatMember: {
          where: vi.fn().mockReturnThis(),
          run: vi
            .fn()
            .mockResolvedValue([{ id: 'cm-1', userId: 'user-1', chatId: 'chat-1' }]),
        },
      },
    })
    const msg = userMessage({
      type: 'sticker',
      text: null,
      metadata: JSON.stringify({ packageId: '1', stickerId: 100 }),
    })
    await mutate.sendLiff({ authData: { id: 'user-1' }, tx } as any, msg)
    expect(inserted).toHaveLength(1)
  })

  it('requires entitlement for Vine marketplace sticker packages', async () => {
    const { tx } = makeTx({
      query: {
        chatMember: {
          where: vi.fn().mockReturnThis(),
          run: vi
            .fn()
            .mockResolvedValue([{ id: 'cm-1', userId: 'user-1', chatId: 'chat-1' }]),
        },
        entitlement: {
          where: vi.fn().mockReturnThis(),
          run: vi.fn().mockResolvedValue([]),
        },
      },
    })
    const msg = userMessage({
      type: 'sticker',
      text: null,
      metadata: JSON.stringify({ packageId: 'pkg_cat_01', stickerId: 1 }),
    })
    await expect(
      mutate.sendLiff({ authData: { id: 'user-1' }, tx } as any, msg),
    ).rejects.toThrow('entitlement required')
  })

  it('updates the chat last-message pointer', async () => {
    const { tx, chatUpdates } = makeTx({
      query: {
        chatMember: {
          where: vi.fn().mockReturnThis(),
          run: vi
            .fn()
            .mockResolvedValue([{ id: 'cm-1', userId: 'user-1', chatId: 'chat-1' }]),
        },
      },
    })
    const msg = userMessage({ createdAt: 12345 })
    await mutate.sendLiff({ authData: { id: 'user-1' }, tx } as any, msg)
    expect(chatUpdates[0]).toEqual({
      id: 'chat-1',
      lastMessageId: 'msg-1',
      lastMessageAt: 12345,
    })
  })
})
