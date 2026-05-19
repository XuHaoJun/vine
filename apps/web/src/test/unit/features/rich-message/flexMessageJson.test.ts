import { describe, expect, it } from 'vitest'
import { defaultFlexMessageJson } from '~/features/rich-message/flex/defaultFlexMessage'
import { parseFlexMessageJson } from '~/features/rich-message/flex/flexMessageJson'

describe('flexMessageJson', () => {
  it('parses valid flex json', () => {
    const result = parseFlexMessageJson(defaultFlexMessageJson)

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.message.type).toBe('flex')
      expect(result.message.altText).toBe('Sample Flex Message')
    }
  })

  it('returns a readable error for invalid json', () => {
    const result = parseFlexMessageJson('{')

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.message.length).toBeGreaterThan(0)
    }
  })
})
