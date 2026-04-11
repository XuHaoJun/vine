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
