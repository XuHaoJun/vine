import { describe, expect, it, vi, beforeEach } from 'vitest'
import { validateAndConvertLiffMessages } from '~/features/liff/liffMessage'

describe('ShareTargetPicker LIFF messages', () => {
  it('sends converted text, image, video, audio, location, and flex messages', () => {
    const textImageVideo = [
      { type: 'text', text: 'Hello' },
      {
        type: 'image',
        originalContentUrl: 'https://example.com/img.jpg',
        previewImageUrl: 'https://example.com/img.jpg',
      },
      {
        type: 'video',
        originalContentUrl: 'https://example.com/vid.mp4',
        previewImageUrl: 'https://example.com/vid.jpg',
      },
    ]
    const audioLocFlex = [
      {
        type: 'audio',
        originalContentUrl: 'https://example.com/audio.mp3',
        duration: 5000,
      },
      {
        type: 'location',
        title: 'Station',
        address: '1 Main St',
        latitude: 35.0,
        longitude: 139.0,
      },
      {
        type: 'flex',
        altText: 'Flex',
        contents: {
          type: 'bubble',
          body: {
            type: 'box',
            layout: 'vertical',
            contents: [
              {
                type: 'button',
                action: { type: 'uri', label: 'Open', uri: 'https://example.com' },
              },
            ],
          },
        },
      },
    ]

    const result1 = validateAndConvertLiffMessages({
      method: 'shareTargetPicker',
      messages: textImageVideo,
    })
    const result2 = validateAndConvertLiffMessages({
      method: 'shareTargetPicker',
      messages: audioLocFlex,
    })

    expect(result1.ok).toBe(true)
    if (result1.ok) {
      expect(result1.messages).toHaveLength(3)
      expect(result1.messages[0]!.type).toBe('text')
      expect(result1.messages[0]!.text).toBe('Hello')
      expect(result1.messages[1]!.type).toBe('image')
      expect(result1.messages[2]!.type).toBe('video')
    }

    expect(result2.ok).toBe(true)
    if (result2.ok) {
      expect(result2.messages).toHaveLength(3)
      expect(result2.messages[0]!.type).toBe('audio')
      expect(result2.messages[1]!.type).toBe('location')
      expect(result2.messages[2]!.type).toBe('flex')
    }
  })

  it('rejects sticker messages before showing target send success', () => {
    const messages = [{ type: 'sticker', packageId: '1', stickerId: 100 }]

    const result = validateAndConvertLiffMessages({
      method: 'shareTargetPicker',
      messages,
    })

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.code).toBe('UNSUPPORTED_MESSAGE')
      expect(result.error.message).toContain('sticker')
    }
  })

  it('returns false on cancel without sending messages', () => {
    const messages = [{ type: 'text', text: 'Hello' }]

    const result = validateAndConvertLiffMessages({
      method: 'shareTargetPicker',
      messages,
    })

    expect(result.ok).toBe(true)
  })
})

describe('sendToTarget', () => {
  const findOrCreateDirectChat = vi.fn()
  const sendLiff = vi.fn()

  const zero = {
    mutate: {
      chat: { findOrCreateDirectChat },
      message: { sendLiff },
    },
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('uses returned chatId for existing friend chats instead of random UUID', async () => {
    findOrCreateDirectChat.mockResolvedValue({ chatId: 'existing-chat-id' })

    const { sendToTarget } = await import('~/features/liff/sendToTarget')

    const target = {
      id: 'friend-u1',
      kind: 'friend' as const,
      name: 'Alice',
      image: null,
      userId: 'u1',
    }

    const messages = [{ type: 'text', text: 'Hello' }]
    await sendToTarget(zero, target, messages, Date.now())

    expect(findOrCreateDirectChat).toHaveBeenCalledWith(
      expect.objectContaining({
        friendUserId: 'u1',
      }),
    )

    expect(sendLiff).toHaveBeenCalledWith(
      expect.objectContaining({
        chatId: 'existing-chat-id',
      }),
    )

    const callArg = sendLiff.mock.calls[0][0]
    expect(callArg.chatId).toBe('existing-chat-id')
    expect(callArg.chatId).not.toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    )
  })

  it('creates new chat when friend has no existing direct chat', async () => {
    findOrCreateDirectChat.mockResolvedValue({ chatId: 'new-chat-id' })

    const { sendToTarget } = await import('~/features/liff/sendToTarget')

    const target = {
      id: 'friend-u2',
      kind: 'friend' as const,
      name: 'Bob',
      image: null,
      userId: 'u2',
    }

    const messages = [{ type: 'text', text: 'Hi' }]
    await sendToTarget(zero, target, messages, Date.now())

    expect(sendLiff).toHaveBeenCalledWith(
      expect.objectContaining({
        chatId: 'new-chat-id',
      }),
    )
  })

  it('sends to existing chatId for non-friend targets', async () => {
    const { sendToTarget } = await import('~/features/liff/sendToTarget')

    const target = {
      id: 'group-g1',
      kind: 'group' as const,
      name: 'Team',
      image: null,
      chatId: 'group-chat-id',
    }

    const messages = [{ type: 'text', text: 'Hey team' }]
    await sendToTarget(zero, target, messages, Date.now())

    expect(findOrCreateDirectChat).not.toHaveBeenCalled()
    expect(sendLiff).toHaveBeenCalledWith(
      expect.objectContaining({
        chatId: 'group-chat-id',
      }),
    )
  })
})
