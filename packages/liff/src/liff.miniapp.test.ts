import { describe, it, expect, beforeEach } from 'vitest'
import { LiffImpl } from './liff'

describe('liff.miniApp.getInfo()', () => {
  it('returns mini app info when miniAppId and miniApp are on the bootstrap', () => {
    const instance = new LiffImpl({
      miniAppId: 'ma-1',
      miniApp: {
        name: 'Pizza',
        iconUrl: 'https://example.com/icon.png',
        description: 'Order pizza',
        category: 'delivery',
      },
    })
    const info = instance.miniApp.getInfo()
    expect(info).toEqual({
      id: 'ma-1',
      name: 'Pizza',
      iconUrl: 'https://example.com/icon.png',
      description: 'Order pizza',
      category: 'delivery',
    })
  })

  it('returns null when mini app fields are not on bootstrap', () => {
    const instance = new LiffImpl({})
    expect(instance.miniApp.getInfo()).toBeNull()
  })

  it('returns null when miniAppId is present but miniApp data is missing', () => {
    const instance = new LiffImpl({ miniAppId: 'ma-1' })
    expect(instance.miniApp.getInfo()).toBeNull()
  })
})

describe('liff.permanentLink.createUrlBy()', () => {
  it('returns mini app URL when miniAppId is provided', () => {
    const instance = new LiffImpl({ apiBaseUrl: 'https://vine.example.com' })
    const url = instance.permanentLink.createUrlBy({
      miniAppId: 'ma-1',
      path: '/orders/123',
    })
    expect(url).toBe('https://vine.example.com/m/ma-1/orders/123')
  })

  it('returns LIFF URL when miniAppId is not provided', () => {
    const instance = new LiffImpl({ apiBaseUrl: 'https://vine.example.com' })
    ;(instance as any)._liffId = 'liff-123'
    const url = instance.permanentLink.createUrlBy({ path: '/orders/123' })
    expect(url).toBe('https://vine.example.com/liff/liff-123/orders/123')
  })
})
