import { describe, expect, it } from 'vitest'
import {
  evaluateAudienceQuery,
  validateAudienceQuery,
  type AudienceContact,
  type AudienceQueryJson,
} from './query'

const vipContact: AudienceContact = {
  friendship: { status: 'friend' },
  providerUserId: 'user-1',
  displayName: 'Alice',
  tags: {
    ids: ['tag-vip', 'tag-spring'],
    names: ['VIP', 'Spring'],
  },
  lastInteractionAt: '2026-05-01T00:00:00.000Z',
  chat: { status: 'active', unread: true },
  note: { exists: true },
}

describe('audience query validation and evaluation', () => {
  it('accepts a controlled Mongo-like predicate using $and, implicit field equality, $all, and $gte', () => {
    const query: AudienceQueryJson = {
      $and: [
        { 'friendship.status': 'friend' },
        { 'tags.ids': { $all: ['tag-vip', 'tag-spring'] } },
        { lastInteractionAt: { $gte: '2026-04-01T00:00:00.000Z' } },
      ],
    }

    expect(validateAudienceQuery(query)).toEqual({ ok: true })
    expect(evaluateAudienceQuery(query, vipContact)).toBe(true)
  })

  it('rejects unknown field', () => {
    expect(validateAudienceQuery({ 'secret.email': 'alice@example.test' })).toEqual({
      ok: false,
      error: 'Unsupported audience field: secret.email',
    })
  })

  it('rejects unknown operator on displayName', () => {
    expect(validateAudienceQuery({ displayName: { $regex: '^A' } })).toEqual({
      ok: false,
      error: 'Unsupported operator for displayName: $regex',
    })
  })

  it('supports $or, $not, $in, $nin, $all, $exists', () => {
    const query: AudienceQueryJson = {
      $and: [
        {
          $or: [
            { providerUserId: { $in: ['user-1', 'user-2'] } },
            { displayName: 'Bob' },
          ],
        },
        { displayName: { $nin: ['Mallory', 'Eve'] } },
        { 'tags.names': { $all: ['VIP', 'Spring'] } },
        { 'tags.ids': { $exists: true } },
        { $not: { 'chat.status': { $in: ['no_chat'] } } },
      ],
    }

    expect(validateAudienceQuery(query)).toEqual({ ok: true })
    expect(evaluateAudienceQuery(query, vipContact)).toBe(true)
  })

  it('rejects excessive depth', () => {
    const query: AudienceQueryJson = {
      $not: {
        $not: {
          $not: {
            $not: {
              providerUserId: 'user-1',
            },
          },
        },
      },
    }

    expect(validateAudienceQuery(query)).toEqual({
      ok: false,
      error: 'Audience query is too deep',
    })
  })

  it('rejects malformed plain object equality values', () => {
    expect(validateAudienceQuery({ displayName: { foo: 'bar' } })).toEqual({
      ok: false,
      error: 'Unsupported value for displayName',
    })
  })

  it('requires boolean $exists operands and supports $exists false', () => {
    expect(validateAudienceQuery({ 'tags.ids': { $exists: 'yes' } })).toEqual({
      ok: false,
      error: 'Unsupported operand for tags.ids.$exists',
    })

    const contactWithoutTags: AudienceContact = {
      ...vipContact,
      tags: { ...vipContact.tags, ids: [] },
    }

    const query: AudienceQueryJson = { 'tags.ids': { $exists: false } }
    expect(validateAudienceQuery(query)).toEqual({ ok: true })
    expect(evaluateAudienceQuery(query, contactWithoutTags)).toBe(true)
    expect(evaluateAudienceQuery(query, vipContact)).toBe(false)
  })

  it('supports $eq and $ne on array fields', () => {
    expect(evaluateAudienceQuery({ 'tags.ids': { $eq: 'tag-vip' } }, vipContact)).toBe(
      true,
    )
    expect(evaluateAudienceQuery({ 'tags.ids': { $eq: 'tag-missing' } }, vipContact)).toBe(
      false,
    )
    expect(evaluateAudienceQuery({ 'tags.ids': { $ne: 'tag-missing' } }, vipContact)).toBe(
      true,
    )
    expect(evaluateAudienceQuery({ 'tags.ids': { $ne: 'tag-vip' } }, vipContact)).toBe(
      false,
    )
  })

  it('supports $in and $nin on array fields', () => {
    expect(
      evaluateAudienceQuery({ 'tags.names': { $in: ['VIP', 'Dormant'] } }, vipContact),
    ).toBe(true)
    expect(
      evaluateAudienceQuery({ 'tags.names': { $in: ['Dormant'] } }, vipContact),
    ).toBe(false)
    expect(
      evaluateAudienceQuery({ 'tags.names': { $nin: ['Dormant'] } }, vipContact),
    ).toBe(true)
    expect(
      evaluateAudienceQuery({ 'tags.names': { $nin: ['VIP'] } }, vipContact),
    ).toBe(false)
  })

  it('does not satisfy lastInteractionAt comparisons when the contact value is null', () => {
    const contactWithoutInteraction: AudienceContact = {
      ...vipContact,
      lastInteractionAt: null,
    }

    expect(
      evaluateAudienceQuery(
        { lastInteractionAt: { $gte: '2026-01-01T00:00:00.000Z' } },
        contactWithoutInteraction,
      ),
    ).toBe(false)
  })

  it('rejects branch lists over the length limit', () => {
    expect(
      validateAudienceQuery({
        $and: Array.from({ length: 21 }, () => ({ providerUserId: 'user-1' })),
      }),
    ).toEqual({
      ok: false,
      error: '$and has too many branches',
    })
  })

  it('rejects empty $and branch lists', () => {
    expect(validateAudienceQuery({ $and: [] })).toEqual({
      ok: false,
      error: '$and must be a non-empty array',
    })
  })

  it('rejects empty $or branch lists', () => {
    expect(validateAudienceQuery({ $or: [] })).toEqual({
      ok: false,
      error: '$or must be a non-empty array',
    })
  })

  it('rejects unsupported logical operators', () => {
    expect(validateAudienceQuery({ $nor: [{ providerUserId: 'user-1' }] })).toEqual({
      ok: false,
      error: 'Unsupported audience logical operator: $nor',
    })
  })

  it('rejects unsupported operators per field', () => {
    expect(validateAudienceQuery({ displayName: { $exists: true } })).toEqual({
      ok: false,
      error: 'Unsupported operator for displayName: $exists',
    })
  })

  it('rejects $exists on note.exists', () => {
    expect(validateAudienceQuery({ 'note.exists': { $exists: true } })).toEqual({
      ok: false,
      error: 'Unsupported operator for note.exists: $exists',
    })
  })

  it('rejects $exists on chat.unread', () => {
    expect(validateAudienceQuery({ 'chat.unread': { $exists: true } })).toEqual({
      ok: false,
      error: 'Unsupported operator for chat.unread: $exists',
    })
  })

  it('evaluates direct boolean equality for true and false boolean pseudo-fields', () => {
    const contactWithoutNote: AudienceContact = {
      ...vipContact,
      chat: { ...vipContact.chat, unread: false },
      note: { exists: false },
    }

    expect(evaluateAudienceQuery({ 'note.exists': true }, vipContact)).toBe(true)
    expect(evaluateAudienceQuery({ 'note.exists': false }, vipContact)).toBe(false)
    expect(evaluateAudienceQuery({ 'note.exists': false }, contactWithoutNote)).toBe(
      true,
    )
    expect(evaluateAudienceQuery({ 'chat.unread': true }, vipContact)).toBe(true)
    expect(evaluateAudienceQuery({ 'chat.unread': false }, contactWithoutNote)).toBe(
      true,
    )
  })

  it('evaluates object-form boolean comparisons for boolean pseudo-fields', () => {
    const contactWithoutNote: AudienceContact = {
      ...vipContact,
      chat: { ...vipContact.chat, unread: false },
      note: { exists: false },
    }

    expect(
      evaluateAudienceQuery({ 'chat.unread': { $eq: false } }, contactWithoutNote),
    ).toBe(true)
    expect(evaluateAudienceQuery({ 'chat.unread': { $eq: false } }, vipContact)).toBe(
      false,
    )
    expect(
      evaluateAudienceQuery({ 'note.exists': { $ne: true } }, contactWithoutNote),
    ).toBe(true)
    expect(evaluateAudienceQuery({ 'note.exists': { $ne: true } }, vipContact)).toBe(
      false,
    )
  })

  it('rejects malformed operator operands', () => {
    expect(validateAudienceQuery({ providerUserId: { $in: 'user-1' } })).toEqual({
      ok: false,
      error: 'Unsupported operand for providerUserId.$in',
    })
    expect(validateAudienceQuery({ 'tags.ids': { $all: ['tag-vip', 1] } })).toEqual({
      ok: false,
      error: 'Unsupported operand for tags.ids.$all',
    })
  })

  it('returns false for negative evaluation cases', () => {
    expect(evaluateAudienceQuery({ 'friendship.status': 'blocked' }, vipContact)).toBe(
      false,
    )
    expect(
      evaluateAudienceQuery(
        { $or: [{ providerUserId: 'user-2' }, { displayName: 'Bob' }] },
        vipContact,
      ),
    ).toBe(false)
    expect(evaluateAudienceQuery({ $not: { displayName: 'Alice' } }, vipContact)).toBe(
      false,
    )
  })
})
