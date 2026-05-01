import { describe, expect, it } from 'vitest'
import {
  createAcceptedRequestId,
  createHttpRequestId,
  createRequestHash,
  createDeterministicMessageIds,
  isValidLineRetryKey,
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
