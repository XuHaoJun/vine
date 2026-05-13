import Fastify from 'fastify'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { oaContactExportPlugin } from './oa-contact-export'

vi.mock('@take-out/better-auth-utils/server', () => ({
  getAuthDataFromRequest: vi.fn(),
}))

import { getAuthDataFromRequest } from '@take-out/better-auth-utils/server'

const mockedAuth = vi.mocked(getAuthDataFromRequest)

function createApp() {
  const contactExport = {
    exportContactsCsv: vi.fn(),
  }
  const auth = {} as any
  const app = Fastify()
  return {
    app,
    auth,
    contactExport,
    register: () => app.register(oaContactExportPlugin, { auth, contactExport }),
  }
}

beforeEach(() => {
  mockedAuth.mockReset()
})

describe('oa-contact-export plugin', () => {
  it('returns 401 when unauthenticated', async () => {
    mockedAuth.mockResolvedValue(null as any)
    const { app, contactExport, register } = createApp()
    await register()

    const res = await app.inject({
      method: 'GET',
      url: '/api/manager/oa/oa-1/contacts/export.csv',
    })

    expect(res.statusCode).toBe(401)
    expect(contactExport.exportContactsCsv).not.toHaveBeenCalled()
  })

  it('returns 404 when the OA is not visible to the authenticated owner', async () => {
    mockedAuth.mockResolvedValue({ id: 'user-2' } as any)
    const { app, contactExport, register } = createApp()
    contactExport.exportContactsCsv.mockResolvedValue(null)
    await register()

    const res = await app.inject({
      method: 'GET',
      url: '/api/manager/oa/oa-1/contacts/export.csv',
    })

    expect(res.statusCode).toBe(404)
    expect(JSON.parse(res.body)).toEqual({ message: 'Official account not found' })
    expect(contactExport.exportContactsCsv).toHaveBeenCalledWith({
      oaId: 'oa-1',
      ownerId: 'user-2',
      exportedAt: expect.any(Date),
    })
  })

  it('returns a CSV attachment for the OA owner', async () => {
    mockedAuth.mockResolvedValue({ id: 'owner-1' } as any)
    const { app, contactExport, register } = createApp()
    contactExport.exportContactsCsv.mockResolvedValue({
      filename: 'oa-test-contacts-2026-05-13.csv',
      csv: 'provider_scoped_user_id\nuser-1',
    })
    await register()

    const res = await app.inject({
      method: 'GET',
      url: '/api/manager/oa/oa-1/contacts/export.csv',
    })

    expect(res.statusCode).toBe(200)
    expect(res.headers['content-type']).toContain('text/csv; charset=utf-8')
    expect(res.headers['content-disposition']).toBe(
      'attachment; filename="oa-test-contacts-2026-05-13.csv"',
    )
    expect(res.body).toBe('provider_scoped_user_id\nuser-1')
  })
})
