import { describe, it, expect, vi, beforeEach } from 'vitest'
import Fastify from 'fastify'
import FormData from 'form-data'
import { mediaUploadPlugin } from './media-upload'

vi.mock('@take-out/better-auth-utils/server', () => ({
  getAuthDataFromRequest: vi.fn(),
}))

import { getAuthDataFromRequest } from '@take-out/better-auth-utils/server'

const mockedAuth = vi.mocked(getAuthDataFromRequest)

function createApp(overrides?: { driveUrl?: string }) {
  const drive = {
    put: vi.fn().mockResolvedValue(undefined),
    get: vi.fn(),
    exists: vi.fn(),
    delete: vi.fn(),
    getUrl: vi
      .fn()
      .mockResolvedValue(overrides?.driveUrl ?? 'http://localhost/uploads/test.jpg'),
  }
  const auth = {} as any
  const app = Fastify()
  return {
    app,
    drive,
    auth,
    register: () => app.register(mediaUploadPlugin, { auth, drive }),
  }
}

function multipartPayload(filename: string, contentType: string, body: Buffer) {
  const form = new FormData()
  form.append('file', body, { filename, contentType })
  return {
    payload: form.getBuffer(),
    headers: form.getHeaders(),
  }
}

beforeEach(() => {
  mockedAuth.mockReset()
})

describe('media-upload plugin', () => {
  it('returns 401 when unauthenticated', async () => {
    mockedAuth.mockResolvedValue(null as any)
    const { app, drive, register } = createApp()
    await register()
    const { payload, headers } = multipartPayload(
      'a.jpg',
      'image/jpeg',
      Buffer.from([1, 2, 3]),
    )
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/media/upload',
      payload,
      headers,
    })
    expect(res.statusCode).toBe(401)
    expect(drive.put).not.toHaveBeenCalled()
  })

  it('rejects unsupported mime types', async () => {
    mockedAuth.mockResolvedValue({ id: 'u1' } as any)
    const { app, drive, register } = createApp()
    await register()
    const { payload, headers } = multipartPayload(
      'a.exe',
      'application/x-msdownload',
      Buffer.from('x'),
    )
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/media/upload',
      payload,
      headers,
    })
    expect(res.statusCode).toBe(415)
    expect(drive.put).not.toHaveBeenCalled()
  })

  it('stores file under media/<userId>/ and returns the drive URL', async () => {
    mockedAuth.mockResolvedValue({ id: 'user-42' } as any)
    const { app, drive, register } = createApp({
      driveUrl: 'http://localhost/uploads/x.jpg',
    })
    await register()
    const { payload, headers } = multipartPayload(
      'photo.jpg',
      'image/jpeg',
      Buffer.from('IMG'),
    )
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/media/upload',
      payload,
      headers,
    })
    expect(res.statusCode).toBe(200)
    expect(JSON.parse(res.body)).toEqual({ url: 'http://localhost/uploads/x.jpg' })
    expect(drive.put).toHaveBeenCalledTimes(1)
    const [key, buffer, mime] = drive.put.mock.calls[0]!
    expect(key).toMatch(/^media\/user-42\/[0-9a-f-]+\.jpg$/)
    expect(Buffer.isBuffer(buffer)).toBe(true)
    expect(mime).toBe('image/jpeg')
  })

  it('rejects files over the size limit with 413', async () => {
    mockedAuth.mockResolvedValue({ id: 'u1' } as any)
    const { app, drive, register } = createApp()
    await register()
    const big = Buffer.alloc(26 * 1024 * 1024, 0)
    const { payload, headers } = multipartPayload('big.mp4', 'video/mp4', big)
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/media/upload',
      payload,
      headers,
    })
    expect(res.statusCode).toBe(413)
    expect(drive.put).not.toHaveBeenCalled()
  })
})
