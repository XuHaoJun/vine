import { describe, expect, it, vi } from 'vitest'

import { mutate as chatMemberMutate } from '../models/chatMember'
import { mutate as messageMutate } from '../models/message'

function chain(rows: unknown[]) {
  return {
    where: vi.fn().mockReturnThis(),
    run: vi.fn().mockResolvedValue(rows),
  }
}

function makeTx(overrides: Record<string, any> = {}) {
  const inserted: unknown[] = []
  const chatUpdates: unknown[] = []
  const memberUpdates: unknown[] = []

  return {
    inserted,
    chatUpdates,
    memberUpdates,
    tx: {
      query: {
        officialAccount: chain([{ id: 'oa-1', providerId: 'provider-1' }]),
        oaProvider: chain([{ id: 'provider-1', ownerId: 'manager-1' }]),
        chat: chain([{ id: 'chat-1', type: 'oa' }]),
        chatMember: chain([{ id: 'oa-member-1', chatId: 'chat-1', oaId: 'oa-1' }]),
        ...overrides.query,
      },
      mutate: {
        message: {
          insert: vi.fn(async (msg: unknown) => inserted.push(msg)),
        },
        chat: {
          update: vi.fn(async (patch: unknown) => chatUpdates.push(patch)),
        },
        chatMember: {
          update: vi.fn(async (patch: unknown) => memberUpdates.push(patch)),
        },
        ...overrides.mutate,
      },
    },
  }
}

describe('message.sendAsOA', () => {
  it('rejects direct message inserts', async () => {
    const { tx } = makeTx()

    await expect(
      (messageMutate as any).insert(
        { authData: { id: 'manager-1' }, can: vi.fn(), tx },
        {
          id: 'msg-1',
          chatId: 'chat-1',
          senderType: 'oa',
          oaId: 'oa-1',
          type: 'text',
          text: 'hello',
          createdAt: 123,
        },
      ),
    ).rejects.toThrow('Use a message action')
  })

  it('rejects direct message updates', async () => {
    const { tx } = makeTx()

    await expect(
      (messageMutate as any).update(
        { authData: { id: 'manager-1' }, can: vi.fn(), tx },
        { id: 'msg-1', senderType: 'oa', oaId: 'oa-1' },
      ),
    ).rejects.toThrow('Use a message action')
  })

  it('rejects OA messages sent through message.send', async () => {
    const { tx } = makeTx()

    await expect(
      (messageMutate as any).send(
        { authData: { id: 'manager-1' }, tx },
        {
          id: 'msg-1',
          chatId: 'chat-1',
          senderType: 'oa',
          oaId: 'oa-1',
          type: 'text',
          text: 'hello',
          createdAt: 123,
        },
      ),
    ).rejects.toThrow('Use sendAsOA for OA messages')
  })

  it('rejects unauthenticated callers', async () => {
    const { tx } = makeTx()

    await expect(
      (messageMutate as any).sendAsOA(
        { authData: undefined, tx },
        {
          id: 'msg-1',
          chatId: 'chat-1',
          oaId: 'oa-1',
          text: 'hello',
          createdAt: 123,
        },
      ),
    ).rejects.toThrow('Unauthorized')
  })

  it('rejects non-owners', async () => {
    const { tx } = makeTx()

    await expect(
      (messageMutate as any).sendAsOA(
        { authData: { id: 'user-1' }, tx },
        {
          id: 'msg-1',
          chatId: 'chat-1',
          oaId: 'oa-1',
          text: 'hello',
          createdAt: 123,
        },
      ),
    ).rejects.toThrow('Unauthorized')
  })

  it('rejects blank text', async () => {
    const { tx } = makeTx()

    await expect(
      (messageMutate as any).sendAsOA(
        { authData: { id: 'manager-1' }, tx },
        {
          id: 'msg-1',
          chatId: 'chat-1',
          oaId: 'oa-1',
          text: '   ',
          createdAt: 123,
        },
      ),
    ).rejects.toThrow('Message text is required')
  })

  it('rejects non-OA chats', async () => {
    const { tx } = makeTx({
      query: {
        chat: chain([]),
      },
    })

    await expect(
      (messageMutate as any).sendAsOA(
        { authData: { id: 'manager-1' }, tx },
        {
          id: 'msg-1',
          chatId: 'chat-1',
          oaId: 'oa-1',
          text: 'hello',
          createdAt: 123,
        },
      ),
    ).rejects.toThrow('Unauthorized')
  })

  it('rejects when the OA is not a chat member', async () => {
    const { tx } = makeTx({
      query: {
        chatMember: chain([]),
      },
    })

    await expect(
      (messageMutate as any).sendAsOA(
        { authData: { id: 'manager-1' }, tx },
        {
          id: 'msg-1',
          chatId: 'chat-1',
          oaId: 'oa-1',
          text: 'hello',
          createdAt: 123,
        },
      ),
    ).rejects.toThrow('Unauthorized')
  })

  it('inserts an OA text message with trimmed text and updates chat metadata', async () => {
    const { tx, inserted, chatUpdates } = makeTx()

    await (messageMutate as any).sendAsOA(
      { authData: { id: 'manager-1' }, tx },
      {
        id: 'msg-1',
        chatId: 'chat-1',
        oaId: 'oa-1',
        text: '  hello from oa  ',
        createdAt: 123,
      },
    )

    expect(inserted).toEqual([
      {
        id: 'msg-1',
        chatId: 'chat-1',
        senderType: 'oa',
        oaId: 'oa-1',
        type: 'text',
        text: 'hello from oa',
        createdAt: 123,
      },
    ])
    expect(chatUpdates).toEqual([
      {
        id: 'chat-1',
        lastMessageId: 'msg-1',
        lastMessageAt: 123,
      },
    ])
  })
})

describe('chatMember.markOARead', () => {
  it('rejects non-owners', async () => {
    const { tx } = makeTx({
      query: {
        oaProvider: chain([{ id: 'provider-1', ownerId: 'other-manager' }]),
      },
    })

    await expect(
      (chatMemberMutate as any).markOARead(
        { authData: { id: 'manager-1' }, tx },
        {
          chatId: 'chat-1',
          oaId: 'oa-1',
          lastReadMessageId: 'msg-1',
          lastReadAt: 456,
        },
      ),
    ).rejects.toThrow('Unauthorized')
  })

  it('rejects direct chatMember updates', async () => {
    const { tx } = makeTx()

    await expect(
      (chatMemberMutate as any).update(
        { authData: { id: 'manager-1' }, can: vi.fn(), tx },
        { id: 'oa-member-1', role: 'owner' },
      ),
    ).rejects.toThrow('Use a chatMember action')
  })

  it('updates only the OA member row', async () => {
    const { tx, memberUpdates } = makeTx({
      query: {
        chatMember: chain([
          { id: 'oa-member-1', chatId: 'chat-1', oaId: 'oa-1' },
          { id: 'user-member-1', chatId: 'chat-1', userId: 'user-1' },
        ]),
      },
    })

    await (chatMemberMutate as any).markOARead(
      { authData: { id: 'manager-1' }, tx },
      {
        chatId: 'chat-1',
        oaId: 'oa-1',
        lastReadMessageId: 'msg-1',
        lastReadAt: 456,
      },
    )

    expect(memberUpdates).toEqual([
      {
        id: 'oa-member-1',
        lastReadMessageId: 'msg-1',
        lastReadAt: 456,
      },
    ])
  })
})
