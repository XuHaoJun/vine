import { describe, expect, it, vi } from 'vitest'
import { createOAService } from './oa'
import { createHmac } from 'crypto'

function createMockDb() {
  return {
    insert: vi.fn().mockReturnValue({
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([{ id: 'test-provider-id' }]),
      }),
    }),
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({ limit: vi.fn().mockResolvedValue([]) }),
      }),
    }),
    update: vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([]),
        }),
      }),
    }),
    delete: vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue([]),
    }),
  }
}

describe('createOAService — Provider', () => {
  it('creates a provider with owner', async () => {
    const mockDb = createMockDb()
    mockDb.insert.mockReturnValue({
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([
          {
            id: 'test-provider-id',
            name: 'Test Provider',
            ownerId: 'user-123',
            createdAt: '2026-04-04T00:00:00Z',
            updatedAt: '2026-04-04T00:00:00Z',
          },
        ]),
      }),
    })

    const oa = createOAService({ db: mockDb as any, database: {} as any })

    const result = await oa.createProvider({
      name: 'Test Provider',
      ownerId: 'user-123',
    })

    expect(mockDb.insert).toHaveBeenCalled()
    expect(result.name).toBe('Test Provider')
    expect(result.ownerId).toBe('user-123')
  })

  it('gets a provider by id', async () => {
    const mockDb = createMockDb()
    mockDb.select.mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([
            {
              id: 'provider-1',
              name: 'Test',
              ownerId: 'user-123',
              createdAt: '2026-04-04T00:00:00Z',
              updatedAt: '2026-04-04T00:00:00Z',
            },
          ]),
        }),
      }),
    })

    const oa = createOAService({ db: mockDb as any, database: {} as any })
    const result = await oa.getProvider('provider-1')

    expect(result).toBeDefined()
    expect(result!.id).toBe('provider-1')
  })

  it('returns null for non-existent provider', async () => {
    const mockDb = createMockDb()
    mockDb.select.mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([]),
        }),
      }),
    })

    const oa = createOAService({ db: mockDb as any, database: {} as any })
    const result = await oa.getProvider('non-existent')

    expect(result).toBeNull()
  })

  it('updates provider name', async () => {
    const mockDb = createMockDb()
    mockDb.update.mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([
            {
              id: 'provider-1',
              name: 'New Name',
              ownerId: 'user-123',
              createdAt: '2026-04-04T00:00:00Z',
              updatedAt: '2026-04-04T00:00:00Z',
            },
          ]),
        }),
      }),
    })

    const oa = createOAService({ db: mockDb as any, database: {} as any })

    await oa.updateProvider('provider-1', { name: 'New Name' })

    expect(mockDb.update).toHaveBeenCalled()
  })

  it('deletes a provider', async () => {
    const mockDb = createMockDb()
    const oa = createOAService({ db: mockDb as any, database: {} as any })

    await oa.deleteProvider('provider-1')

    expect(mockDb.delete).toHaveBeenCalled()
  })
})

describe('createOAService — OfficialAccount', () => {
  it('creates an official account with channelSecret', async () => {
    const mockDb = createMockDb()
    mockDb.insert.mockReturnValueOnce({
      values: vi.fn().mockReturnValueOnce({
        returning: vi
          .fn()
          .mockResolvedValue([{ id: 'oa-1', name: 'Test OA', channelSecret: 'abc123' }]),
      }),
    })

    const oa = createOAService({ db: mockDb as any, database: {} as any })

    const result = await oa.createOfficialAccount({
      providerId: 'provider-1',
      name: 'Test OA',
      uniqueId: '@testbot',
    })

    expect(mockDb.insert).toHaveBeenCalled()
    expect(result.name).toBe('Test OA')
    expect(result.channelSecret).toBeDefined()
    expect(result.channelSecret.length).toBeGreaterThan(0)
  })

  it('gets an official account by id', async () => {
    const mockDb = createMockDb()
    mockDb.select.mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([{ id: 'oa-1', name: 'Test OA' }]),
        }),
      }),
    })

    const oa = createOAService({ db: mockDb as any, database: {} as any })
    const result = await oa.getOfficialAccount('oa-1')

    expect(result).toBeDefined()
    expect(result!.id).toBe('oa-1')
  })

  it('returns null for non-existent OA', async () => {
    const mockDb = createMockDb()
    mockDb.select.mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({ limit: vi.fn().mockResolvedValue([]) }),
      }),
    })

    const oa = createOAService({ db: mockDb as any, database: {} as any })
    const result = await oa.getOfficialAccount('non-existent')

    expect(result).toBeNull()
  })

  it('updates official account fields', async () => {
    const mockDb = createMockDb()
    const oa = createOAService({ db: mockDb as any, database: {} as any })

    await oa.updateOfficialAccount('oa-1', { name: 'Updated Name' })

    expect(mockDb.update).toHaveBeenCalled()
  })

  it('deletes an official account', async () => {
    const mockDb = createMockDb()
    const oa = createOAService({ db: mockDb as any, database: {} as any })

    await oa.deleteOfficialAccount('oa-1')

    expect(mockDb.delete).toHaveBeenCalled()
  })
})

describe('createOAService — Webhook', () => {
  it('sets a webhook URL', async () => {
    const mockDb = createMockDb()
    mockDb.insert.mockReturnValueOnce({
      values: vi.fn().mockReturnValueOnce({
        onConflictDoUpdate: vi.fn().mockReturnValueOnce({
          returning: vi.fn().mockResolvedValue([{ id: 'webhook-1' }]),
        }),
      }),
    })

    const oa = createOAService({ db: mockDb as any, database: {} as any })

    const result = await oa.setWebhook('oa-1', 'https://example.com/webhook')

    expect(result).toBeDefined()
    expect(mockDb.insert).toHaveBeenCalled()
  })

  it('gets webhook by oaId', async () => {
    const mockDb = createMockDb()
    mockDb.select.mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi
            .fn()
            .mockResolvedValue([{ id: 'webhook-1', url: 'https://example.com' }]),
        }),
      }),
    })

    const oa = createOAService({ db: mockDb as any, database: {} as any })
    const result = await oa.getWebhook('oa-1')

    expect(result).toBeDefined()
  })

  it('returns undefined when no webhook exists', async () => {
    const mockDb = createMockDb()
    mockDb.select.mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({ limit: vi.fn().mockResolvedValue([]) }),
      }),
    })

    const oa = createOAService({ db: mockDb as any, database: {} as any })
    const result = await oa.getWebhook('oa-1')

    expect(result).toBeUndefined()
  })
})

describe('createOAService — Access Tokens', () => {
  it('issues a short-lived access token', async () => {
    const mockDb = createMockDb()
    mockDb.insert.mockReturnValueOnce({
      values: vi.fn().mockResolvedValue([{ id: 'token-1' }]),
    })

    const oa = createOAService({ db: mockDb as any, database: {} as any })

    const result = await oa.issueAccessToken({
      oaId: 'oa-1',
      type: 'short_lived',
    })

    expect(result.access_token).toBeDefined()
    expect(result.token_type).toBe('Bearer')
    expect(result.expires_in).toBe(2592000)
  })

  it('issues a JWT v2.1 access token with keyId', async () => {
    const mockDb = createMockDb()
    mockDb.insert.mockReturnValueOnce({
      values: vi.fn().mockResolvedValue([{ id: 'token-1' }]),
    })

    const oa = createOAService({ db: mockDb as any, database: {} as any })

    const result = await oa.issueAccessToken({
      oaId: 'oa-1',
      type: 'jwt_v21',
      publicKey: '-----BEGIN PUBLIC KEY-----\ntest\n-----END PUBLIC KEY-----',
    })

    expect(result.access_token).toBeDefined()
    expect(result.key_id).toBeDefined()
  })

  it('lists access tokens by oaId', async () => {
    const mockDb = createMockDb()
    mockDb.select.mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: vi
          .fn()
          .mockResolvedValue([
            { id: 'token-1', type: 'short_lived', createdAt: '2026-04-04' },
          ]),
      }),
    })

    const oa = createOAService({ db: mockDb as any, database: {} as any })
    const result = await oa.listAccessTokens('oa-1')

    expect(result).toHaveLength(1)
  })

  it('revokes an access token by id', async () => {
    const mockDb = createMockDb()
    const oa = createOAService({ db: mockDb as any, database: {} as any })

    await oa.revokeAccessToken('token-1')

    expect(mockDb.delete).toHaveBeenCalled()
  })

  it('revokes all access tokens by keyId', async () => {
    const mockDb = createMockDb()
    mockDb.delete.mockReturnValueOnce({
      where: vi.fn().mockReturnValueOnce({
        returning: vi
          .fn()
          .mockResolvedValue([{ id: 'token-1' }, { id: 'token-2' }, { id: 'token-3' }]),
      }),
    })

    const oa = createOAService({ db: mockDb as any, database: {} as any })
    const result = await oa.revokeAllAccessTokens('oa-1', 'key-123')

    expect(result.revoked_count).toBe(3)
  })
})

describe('createOAService — Webhook Dispatch', () => {
  it('generates correct HMAC-SHA256 signature', () => {
    const oa = createOAService({ db: createMockDb() as any, database: {} as any })
    const body = JSON.stringify({ test: 'data' })
    const secret = 'test-secret'

    const signature = oa.generateWebhookSignature(body, secret)
    const expected = createHmac('SHA256', secret).update(body).digest('base64')

    expect(signature).toBe(expected)
  })

  it('builds correct CallbackRequest for message event', () => {
    const oa = createOAService({ db: createMockDb() as any, database: {} as any })

    const payload = oa.buildMessageEvent({
      oaId: 'oa-1',
      userId: 'user-123',
      messageId: 'msg-1',
      text: 'Hello',
      replyToken: 'reply-1',
    })

    expect(payload.destination).toBe('oa-1')
    expect(payload.events).toHaveLength(1)
    expect(payload.events[0].type).toBe('message')
    expect(payload.events[0].message.type).toBe('text')
    expect(payload.events[0].message.text).toBe('Hello')
    expect(payload.events[0].replyToken).toBe('reply-1')
  })

  it('builds correct follow event', () => {
    const oa = createOAService({ db: createMockDb() as any, database: {} as any })

    const payload = oa.buildFollowEvent({
      oaId: 'oa-1',
      userId: 'user-123',
      replyToken: 'reply-1',
    })

    expect(payload.events[0].type).toBe('follow')
    expect(payload.events[0].follow.isUnblocked).toBe(false)
  })

  it('builds correct unfollow event', () => {
    const oa = createOAService({ db: createMockDb() as any, database: {} as any })

    const payload = oa.buildUnfollowEvent({
      oaId: 'oa-1',
      userId: 'user-123',
    })

    expect(payload.events[0].type).toBe('unfollow')
    expect('replyToken' in payload.events[0]).toBe(false)
  })
})

describe('createOAService — Search', () => {
  it('searches OAs by oaId or name', async () => {
    const mockDb = createMockDb()
    mockDb.select.mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([
            {
              id: 'oa-1',
              name: 'Test Bot',
              oaId: '@testbot',
              description: 'A test bot',
              imageUrl: '',
            },
          ]),
        }),
      }),
    })

    const oa = createOAService({ db: mockDb as any, database: {} as any })
    const result = await oa.searchOAs('test')

    expect(result).toHaveLength(1)
    expect(result[0].name).toBe('Test Bot')
  })
})

describe('createOAService — findOfficialAccountByUniqueId', () => {
  it('returns account when found by uniqueId', async () => {
    const mockDb = createMockDb()
    mockDb.select.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([
            {
              id: 'oa-uuid',
              name: 'Flex Message sim',
              uniqueId: 'flexmessagesim',
              description: null,
              imageUrl: null,
            },
          ]),
        }),
      }),
    })

    const oa = createOAService({ db: mockDb as any, database: {} as any })
    const result = await oa.findOfficialAccountByUniqueId('flexmessagesim')

    expect(result).not.toBeNull()
    expect(result?.id).toBe('oa-uuid')
    expect(result?.uniqueId).toBe('flexmessagesim')
  })

  it('returns null when OA not found', async () => {
    const mockDb = createMockDb()
    // default createMockDb returns [] for selects

    const oa = createOAService({ db: mockDb as any, database: {} as any })
    const result = await oa.findOfficialAccountByUniqueId('nonexistent')

    expect(result).toBeNull()
  })
})

describe('createOAService — VerifyWebhook', () => {
  it('returns no_webhook when webhook does not exist', async () => {
    const mockDb = createMockDb()
    mockDb.select.mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({ limit: vi.fn().mockResolvedValue([]) }),
      }),
    })

    const oa = createOAService({ db: mockDb as any, database: {} as any })
    const result = await oa.verifyWebhook('oa-1')

    expect(result.success).toBe(false)
    expect(result.status).toBe('no_webhook')
  })

  it('returns oa_not_found when account does not exist', async () => {
    const mockDb = createMockDb()
    mockDb.select
      .mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi
              .fn()
              .mockResolvedValue([{ id: 'webhook-1', url: 'https://example.com' }]),
          }),
        }),
      })
      .mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({ limit: vi.fn().mockResolvedValue([]) }),
        }),
      })

    const oa = createOAService({ db: mockDb as any, database: {} as any })
    const result = await oa.verifyWebhook('oa-1')

    expect(result.success).toBe(false)
    expect(result.status).toBe('oa_not_found')
  })
})

describe('createOAService — sendOAMessage', () => {
  function createMockTransaction(existingChatId?: string) {
    return vi.fn().mockImplementation(async (cb: (tx: any) => Promise<any>) => {
      const mockTx = {
        select: vi
          .fn()
          .mockReturnValueOnce({
            // userChatSubquery: tx.select({ chatId }).from(chatMember).where(...)
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                // subquery — not awaited directly, used as inArray arg
              }),
            }),
          })
          .mockReturnValueOnce({
            // existingChat: tx.select({ id }).from(chat).innerJoin(...).where(...).limit(1)
            from: vi.fn().mockReturnValue({
              innerJoin: vi.fn().mockReturnValue({
                where: vi.fn().mockReturnValue({
                  limit: vi
                    .fn()
                    .mockResolvedValue(existingChatId ? [{ id: existingChatId }] : []),
                }),
              }),
            }),
          }),
        insert: vi.fn().mockReturnValue({
          values: vi.fn().mockResolvedValue(undefined),
        }),
      }
      return cb(mockTx)
    })
  }

  it('sends message to existing chat', async () => {
    const mockDb = {
      ...createMockDb(),
      transaction: createMockTransaction('existing-chat-id'),
      insert: vi.fn().mockReturnValue({ values: vi.fn().mockResolvedValue(undefined) }),
      update: vi.fn().mockReturnValue({
        set: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) }),
      }),
    }

    const oa = createOAService({ db: mockDb as any, database: {} as any })
    const result = await oa.sendOAMessage('oa-id', 'user-id', {
      type: 'text',
      text: 'hello',
      metadata: null,
    })

    expect(result.success).toBe(true)
    expect(result.chatId).toBe('existing-chat-id')
    expect(result.messageId).toBeDefined()
  })

  it('creates new chat when none exists', async () => {
    const mockDb = {
      ...createMockDb(),
      transaction: createMockTransaction(), // no existing chat
      insert: vi.fn().mockReturnValue({ values: vi.fn().mockResolvedValue(undefined) }),
      update: vi.fn().mockReturnValue({
        set: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) }),
      }),
    }

    const oa = createOAService({ db: mockDb as any, database: {} as any })
    const result = await oa.sendOAMessage('oa-id', 'user-id', {
      type: 'flex',
      text: null,
      metadata: JSON.stringify({
        type: 'flex',
        altText: 'test',
        contents: { type: 'bubble' },
      }),
    })

    expect(result.success).toBe(true)
    expect(result.chatId).toBeDefined()
    expect(result.messageId).toBeDefined()
  })

  it('stores flex message metadata', async () => {
    const mockInsertValues = vi.fn().mockResolvedValue(undefined)
    const mockDb = {
      ...createMockDb(),
      transaction: createMockTransaction('chat-1'),
      insert: vi.fn().mockReturnValue({ values: mockInsertValues }),
      update: vi.fn().mockReturnValue({
        set: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) }),
      }),
    }

    const oa = createOAService({ db: mockDb as any, database: {} as any })
    await oa.sendOAMessage('oa-id', 'user-id', {
      type: 'flex',
      text: null,
      metadata: '{"type":"flex"}',
    })

    const insertCall = mockInsertValues.mock.calls[0][0]
    expect(insertCall.type).toBe('flex')
    expect(insertCall.text).toBeNull()
    expect(insertCall.metadata).toBe('{"type":"flex"}')
    expect(insertCall.oaId).toBe('oa-id')
    expect(insertCall.senderType).toBe('oa')
  })

  it('updates chat lastMessageId and lastMessageAt', async () => {
    const mockUpdateSet = vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue(undefined),
    })
    const mockDb = {
      ...createMockDb(),
      transaction: createMockTransaction('chat-1'),
      insert: vi.fn().mockReturnValue({ values: vi.fn().mockResolvedValue(undefined) }),
      update: vi.fn().mockReturnValue({ set: mockUpdateSet }),
    }

    const oa = createOAService({ db: mockDb as any, database: {} as any })
    await oa.sendOAMessage('oa-id', 'user-id', {
      type: 'text',
      text: 'hello',
      metadata: null,
    })

    expect(mockUpdateSet).toHaveBeenCalledOnce()
  })
})

describe('createOAService — updateRichMenu', () => {
  it('calls db.update with the right values', async () => {
    const mockDb = createMockDb()
    const oa = createOAService({ db: mockDb as any, database: {} as any })

    await oa.updateRichMenu('oa-123', 'richmenu-456', {
      name: 'Updated',
      chatBarText: 'Tap',
      selected: true,
      sizeWidth: 2500,
      sizeHeight: 1686,
      areas: [
        {
          bounds: { x: 0, y: 0, width: 2500, height: 1686 },
          action: { type: 'message', text: 'Hello' },
        },
      ],
    })

    expect(mockDb.update).toHaveBeenCalled()
    const setCall = mockDb.update.mock.results[0].value.set.mock.calls[0][0]
    expect(setCall.name).toBe('Updated')
    expect(setCall.selected).toBe(true)
    expect(setCall.sizeWidth).toBe(2500)
    expect(setCall.areas).toEqual([
      {
        bounds: { x: 0, y: 0, width: 2500, height: 1686 },
        action: { type: 'message', text: 'Hello' },
      },
    ])
  })
})

describe('createOAService — checkAndIncrementUsage', () => {
  it('allows request when currentUsage + delta <= monthlyLimit', async () => {
    const mockDb = {
      ...createMockDb(),
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([
              {
                oaId: 'oa-123',
                monthlyLimit: 1000,
                currentUsage: 500,
                resetAt: new Date().toISOString(),
              },
            ]),
          }),
        }),
      }),
      update: vi.fn().mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([{ currentUsage: 501 }]),
          }),
        }),
      }),
    }
    const oa = createOAService({ db: mockDb as any, database: {} as any })

    const result = await oa.checkAndIncrementUsage('oa-123', 1)

    expect(result).toBe(true)
  })

  it('rejects request when currentUsage + delta > monthlyLimit', async () => {
    const mockDb = {
      ...createMockDb(),
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([
              {
                oaId: 'oa-123',
                monthlyLimit: 1000,
                currentUsage: 999,
                resetAt: new Date().toISOString(),
              },
            ]),
          }),
        }),
      }),
    }
    const oa = createOAService({ db: mockDb as any, database: {} as any })

    const result = await oa.checkAndIncrementUsage('oa-123', 2)

    expect(result).toBe(false)
  })

  it('uses atomic update to prevent race conditions with delta > 1', async () => {
    let callCount = 0
    const mockDb = {
      ...createMockDb(),
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([
              {
                oaId: 'oa-123',
                monthlyLimit: 1000,
                currentUsage: 999,
                resetAt: new Date().toISOString(),
              },
            ]),
          }),
        }),
      }),
      update: vi.fn().mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockImplementation(() => {
            callCount++
            const returning = vi
              .fn()
              .mockResolvedValue(
                callCount === 1 ? [{ oaId: 'oa-123', currentUsage: 1001 }] : [],
              )
            return { returning }
          }),
        }),
      }),
    }
    const oa = createOAService({ db: mockDb as any, database: {} as any })

    const [result1, result2] = await Promise.all([
      oa.checkAndIncrementUsage('oa-123', 2),
      oa.checkAndIncrementUsage('oa-123', 2),
    ])

    const successes = [result1, result2].filter(Boolean).length
    expect(successes).toBe(1)
  })
})

describe('createOAService — setQuota', () => {
  it('preserves currentUsage when updating monthlyLimit', async () => {
    const mockInsertValues = vi.fn().mockResolvedValue(undefined)
    const mockOnConflictDoUpdate = vi.fn().mockReturnValue({ values: mockInsertValues })
    const mockDb = {
      ...createMockDb(),
      insert: vi.fn().mockReturnValue({
        values: vi.fn().mockReturnValue({
          onConflictDoUpdate: mockOnConflictDoUpdate,
        }),
      }),
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([
              {
                oaId: 'oa-123',
                monthlyLimit: 1000,
                currentUsage: 500,
                resetAt: new Date().toISOString(),
              },
            ]),
          }),
        }),
      }),
    }
    const oa = createOAService({ db: mockDb as any, database: {} as any })

    await oa.setQuota('oa-123', 2000)

    expect(mockOnConflictDoUpdate).toHaveBeenCalled()
    const setCall = mockOnConflictDoUpdate.mock.calls[0][0] as {
      set: Record<string, unknown>
    }
    expect(setCall.set).toHaveProperty('monthlyLimit', 2000)
    expect(setCall.set).not.toHaveProperty('currentUsage')
  })
})

describe('createOAService — Reply Token', () => {
  it('registers reply token and returns token string', async () => {
    const mockReturning = vi.fn().mockResolvedValue([
      {
        id: 'token-id-1',
        oaId: 'oa-1',
        token: 'reply-token-abc',
        userId: 'user-1',
        chatId: 'chat-1',
        messageId: 'msg-1',
        used: false,
        expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
      },
    ])
    const mockDb = {
      ...createMockDb(),
      insert: vi.fn().mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: mockReturning,
        }),
      }),
    }
    const oa = createOAService({ db: mockDb as any, database: {} as any })

    const result = await oa.registerReplyToken({
      oaId: 'oa-1',
      userId: 'user-1',
      chatId: 'chat-1',
      messageId: 'msg-1',
    })

    expect(result.token).toBe('reply-token-abc')
    expect(mockDb.insert).toHaveBeenCalled()
  })

  it('resolves valid reply token', async () => {
    const mockDb = {
      ...createMockDb(),
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([
              {
                id: 'token-id-1',
                oaId: 'oa-1',
                token: 'reply-token-abc',
                userId: 'user-1',
                chatId: 'chat-1',
                messageId: 'msg-1',
                used: false,
                expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
              },
            ]),
          }),
        }),
      }),
    }
    const oa = createOAService({ db: mockDb as any, database: {} as any })

    const result = await oa.resolveReplyToken('reply-token-abc')

    expect(result.valid).toBe(true)
    expect(result.record!.userId).toBe('user-1')
  })

  it('returns not_found for unknown token', async () => {
    const mockDb = {
      ...createMockDb(),
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      }),
    }
    const oa = createOAService({ db: mockDb as any, database: {} as any })

    const result = await oa.resolveReplyToken('unknown-token')

    expect(result.valid).toBe(false)
    expect(result.reason).toBe('not_found')
  })

  it('returns already_used for consumed token', async () => {
    const mockDb = {
      ...createMockDb(),
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([
              {
                id: 'token-id-1',
                oaId: 'oa-1',
                token: 'reply-token-abc',
                userId: 'user-1',
                chatId: 'chat-1',
                messageId: 'msg-1',
                used: true,
                expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
              },
            ]),
          }),
        }),
      }),
    }
    const oa = createOAService({ db: mockDb as any, database: {} as any })

    const result = await oa.resolveReplyToken('reply-token-abc')

    expect(result.valid).toBe(false)
    expect(result.reason).toBe('already_used')
  })

  it('returns expired for expired token', async () => {
    const mockDb = {
      ...createMockDb(),
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([
              {
                id: 'token-id-1',
                oaId: 'oa-1',
                token: 'reply-token-abc',
                userId: 'user-1',
                chatId: 'chat-1',
                messageId: 'msg-1',
                used: false,
                expiresAt: new Date(Date.now() - 1000).toISOString(),
              },
            ]),
          }),
        }),
      }),
    }
    const oa = createOAService({ db: mockDb as any, database: {} as any })

    const result = await oa.resolveReplyToken('reply-token-abc')

    expect(result.valid).toBe(false)
    expect(result.reason).toBe('expired')
  })

  it('marks reply token as used', async () => {
    const mockReturning = vi.fn().mockResolvedValue([{ id: 'token-id-1', used: true }])
    const mockDb = {
      ...createMockDb(),
      update: vi.fn().mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: mockReturning,
          }),
        }),
      }),
    }
    const oa = createOAService({ db: mockDb as any, database: {} as any })

    await oa.markReplyTokenUsed('token-id-1')

    expect(mockDb.update).toHaveBeenCalled()
  })
})
