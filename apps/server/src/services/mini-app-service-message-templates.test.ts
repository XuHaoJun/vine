import { describe, expect, it, vi } from 'vitest'
import {
  createMiniAppTemplateService,
  BUILTIN_TEMPLATE_KINDS,
} from './mini-app-service-message-templates'

describe('createMiniAppTemplateService', () => {
  it('caps templates per mini app at 20', async () => {
    const db = {
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(new Array(20).fill({ id: 'x' })),
        }),
      }),
      insert: vi.fn(),
    }
    const svc = createMiniAppTemplateService({ db: db as any })
    await expect(
      svc.createTemplate({
        miniAppId: 'ma-1',
        kind: 'reservation_confirmation',
        languageTag: 'en',
        flexJson: { type: 'bubble' },
        paramsSchema: [],
        useCase: 'test',
        name: 'reservation_confirmation_en',
      }),
    ).rejects.toThrow(/maximum 20/)
  })

  it('exposes 5 builtin kinds', () => {
    expect(BUILTIN_TEMPLATE_KINDS).toEqual([
      'reservation_confirmation',
      'queue_position',
      'delivery_update',
      'generic_notification',
      'custom_flex',
    ])
  })
})
