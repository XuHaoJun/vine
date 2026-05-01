import { describe, expect, it, vi } from 'vitest'
import {
  createAcceptedRequestId,
  createHttpRequestId,
  createRequestHash,
  createDeterministicMessageIds,
  isValidLineRetryKey,
  checkRetryKeyForRequest,
  createOAMessagingService,
} from './oa-messaging'

describe('oa messaging request utilities', () => {
  it('validates LINE retry-key UUID shape', () => {
    expect(isValidLineRetryKey('123e4567-e89b-12d3-a456-426614174000')).toBe(true)
    expect(isValidLineRetryKey('not-a-uuid')).toBe(false)
  })

  it('hashes normalized request content deterministically', () => {
    const one = createRequestHash({
      endpoint: 'push',
      target: { to: 'user-1' },
      messages: [{ type: 'text', text: 'hello' }],
    })
    const two = createRequestHash({
      messages: [{ text: 'hello', type: 'text' }],
      target: { to: 'user-1' },
      endpoint: 'push',
    })

    expect(one).toBe(two)
  })

  it('creates deterministic message ids for a request delivery', () => {
    expect(
      createDeterministicMessageIds({
        requestId: 'req-1',
        userId: 'user-1',
        messageCount: 2,
      }),
    ).toEqual(['oa:req:req-1:user-1:0', 'oa:req:req-1:user-1:1'])
  })

  it('creates request ids with stable prefixes', () => {
    expect(createHttpRequestId()).toMatch(/^req_/)
    expect(createAcceptedRequestId()).toMatch(/^acc_/)
  })
})

function makeMockDbForRetryKeyLookup(existingRetryRows: unknown[] = []) {
  const retryLimit = vi.fn().mockResolvedValue(existingRetryRows)
  const db = {
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({ limit: retryLimit }),
      }),
    }),
  } as any
  return { db, retryLimit }
}

describe('oa messaging retry-key lookup', () => {
  it('rejects retry key on reply', async () => {
    const { db } = makeMockDbForRetryKeyLookup()

    const result = await checkRetryKeyForRequest({
      db,
      now: () => new Date('2026-05-01T00:00:00.000Z'),
      oaId: 'oa-1',
      requestType: 'reply',
      retryKey: '123e4567-e89b-12d3-a456-426614174000',
      target: { replyToken: 'reply-1' },
      messages: [{ type: 'text', text: 'hello' }],
    })

    expect(result).toMatchObject({ ok: false, code: 'INVALID_RETRY_KEY' })
  })

  it('returns duplicate accepted retry-key response', async () => {
    const { db } = makeMockDbForRetryKeyLookup([
      {
        requestId: 'request-original',
        oaId: 'oa-1',
        retryKey: '123e4567-e89b-12d3-a456-426614174000',
        requestHash: createRequestHash({
          endpoint: 'push',
          target: { to: 'user-1' },
          messages: [{ type: 'text', text: 'hello' }],
        }),
        acceptedRequestId: 'acc_original',
        expiresAt: '2026-05-02T00:00:00.000Z',
      },
    ])

    const result = await checkRetryKeyForRequest({
      db,
      now: () => new Date('2026-05-01T00:00:00.000Z'),
      oaId: 'oa-1',
      requestType: 'push',
      retryKey: '123e4567-e89b-12d3-a456-426614174000',
      target: { to: 'user-1' },
      messages: [{ type: 'text', text: 'hello' }],
    })

    expect(result).toMatchObject({
      ok: false,
      code: 'RETRY_KEY_ACCEPTED',
      requestId: 'request-original',
      acceptedRequestId: 'acc_original',
    })
  })

  it('rejects retry-key reuse with a different body', async () => {
    const { db } = makeMockDbForRetryKeyLookup([
      {
        requestHash: 'different-hash',
        acceptedRequestId: 'acc_original',
        expiresAt: '2026-05-02T00:00:00.000Z',
      },
    ])

    const result = await checkRetryKeyForRequest({
      db,
      now: () => new Date('2026-05-01T00:00:00.000Z'),
      oaId: 'oa-1',
      requestType: 'push',
      retryKey: '123e4567-e89b-12d3-a456-426614174000',
      target: { to: 'user-1' },
      messages: [{ type: 'text', text: 'hello' }],
    })

    expect(result).toMatchObject({
      ok: false,
      code: 'RETRY_KEY_CONFLICT',
    })
  })

  it('ignores expired retry-key rows so the key can be accepted again', async () => {
    const { db } = makeMockDbForRetryKeyLookup([])

    const result = await checkRetryKeyForRequest({
      db,
      now: () => new Date('2026-05-01T00:00:00.000Z'),
      oaId: 'oa-1',
      requestType: 'push',
      retryKey: '123e4567-e89b-12d3-a456-426614174000',
      target: { to: 'user-1' },
      messages: [{ type: 'text', text: 'hello' }],
    })

    expect(result).toMatchObject({ ok: true })
  })
})

describe('oa messaging recovery', () => {
  it('exposes processPendingDeliveries for startup recovery', () => {
    const service = createOAMessagingService({
      db: {} as any,
      instanceId: 'test',
      now: () => new Date('2026-05-01T00:00:00.000Z'),
    })

    expect(typeof service.processPendingDeliveries).toBe('function')
  })
})

describe('oa messaging delivery creation', () => {
  it('creates one delivery per recipient with deterministic message ids', async () => {
    const deliveryRows: unknown[] = []
    const db = {
      insert: vi.fn().mockReturnValue({
        values: vi.fn((rows: unknown[]) => {
          deliveryRows.push(...rows)
          return { onConflictDoNothing: vi.fn().mockResolvedValue(undefined) }
        }),
      }),
    } as any
    const service = createOAMessagingService({
      db,
      instanceId: 'test',
      now: () => new Date('2026-05-01T00:00:00.000Z'),
    })

    await service.createDeliveryRows({
      requestId: 'request-1',
      oaId: 'oa-1',
      userIds: ['user-1', 'user-2'],
      messageCount: 2,
    })

    expect(deliveryRows).toEqual([
      expect.objectContaining({
        requestId: 'request-1',
        oaId: 'oa-1',
        userId: 'user-1',
        messageIdsJson: ['oa:req:request-1:user-1:0', 'oa:req:request-1:user-1:1'],
      }),
      expect.objectContaining({
        requestId: 'request-1',
        oaId: 'oa-1',
        userId: 'user-2',
        messageIdsJson: ['oa:req:request-1:user-2:0', 'oa:req:request-1:user-2:1'],
      }),
    ])
  })
})
