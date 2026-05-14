import { describe, expect, it } from 'vitest'
import {
  formatAudienceQuery,
  parseAudienceQueryText,
} from '~/features/oa-manager/campaign/audienceQueryForm'

describe('audience query builder helpers', () => {
  it('parses a valid controlled audience query', () => {
    expect(
      parseAudienceQueryText(
        JSON.stringify({
          $and: [
            { 'friendship.status': 'friend' },
            { 'tags.names': { $in: ['VIP'] } },
          ],
        }),
      ),
    ).toEqual({
      ok: true,
      query: {
        $and: [
          { 'friendship.status': 'friend' },
          { 'tags.names': { $in: ['VIP'] } },
        ],
      },
    })
  })

  it('rejects invalid JSON text', () => {
    expect(parseAudienceQueryText('{ nope')).toEqual({
      ok: false,
      error: 'Audience query must be valid JSON',
    })
  })

  it('rejects unsupported fields', () => {
    expect(parseAudienceQueryText(JSON.stringify({ email: 'a@example.test' }))).toEqual({
      ok: false,
      error: 'Unsupported audience field: email',
    })
  })

  it('formats query JSON for editing', () => {
    expect(formatAudienceQuery({ 'friendship.status': 'friend' })).toBe(
      '{\n  "friendship.status": "friend"\n}',
    )
  })
})
