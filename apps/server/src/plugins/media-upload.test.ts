import { describe, it, expect, vi, beforeEach } from 'vitest'
import Fastify from 'fastify'
import FormData from 'form-data'
import { mediaUploadPlugin, stripMimeParams } from './media-upload'

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

  it('rejects files over the multipart cap with 413', async () => {
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

  it('rejects images over the per-type 10 MB cap with 413', async () => {
    mockedAuth.mockResolvedValue({ id: 'u1' } as any)
    const { app, drive, register } = createApp()
    await register()
    // 11 MB image — under the 25 MB multipart cap, over the 10 MB image cap.
    const big = Buffer.alloc(11 * 1024 * 1024, 0)
    const { payload, headers } = multipartPayload('big.jpg', 'image/jpeg', big)
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/media/upload',
      payload,
      headers,
    })
    expect(res.statusCode).toBe(413)
    expect(JSON.parse(res.body).message).toMatch(/image.*10 MB/)
    expect(drive.put).not.toHaveBeenCalled()
  })

  it.each([
    ['image/gif', 'pic.gif'],
    ['image/webp', 'pic.webp'],
    ['video/quicktime', 'clip.mov'],
    ['video/webm', 'clip.webm'],
  ] as const)('rejects %s as outside the LINE format set', async (mime, name) => {
    mockedAuth.mockResolvedValue({ id: 'u1' } as any)
    const { app, drive, register } = createApp()
    await register()
    const { payload, headers } = multipartPayload(name, mime, Buffer.from('x'))
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/media/upload',
      payload,
      headers,
    })
    expect(res.statusCode).toBe(415)
    expect(drive.put).not.toHaveBeenCalled()
  })

  it('accepts audio/webm;codecs=opus from a browser MediaRecorder', async () => {
    mockedAuth.mockResolvedValue({ id: 'u1' } as any)
    const { app, drive, register } = createApp({
      driveUrl: 'http://localhost/uploads/audio.webm',
    })
    await register()
    const { payload, headers } = multipartPayload(
      'audio.webm',
      'audio/webm;codecs=opus',
      Buffer.from('OPUS'),
    )
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/media/upload',
      payload,
      headers,
    })
    expect(res.statusCode).toBe(200)
    expect(drive.put).toHaveBeenCalledTimes(1)
    const [key, _buf, mime] = drive.put.mock.calls[0]!
    // Stored under .webm and tagged with the stripped MIME (no codec param).
    expect(key).toMatch(/^media\/u1\/[0-9a-f-]+\.webm$/)
    expect(mime).toBe('audio/webm')
  })
})

describe('stripMimeParams', () => {
  it('returns the base type unchanged when no parameters are present', () => {
    expect(stripMimeParams('image/jpeg')).toBe('image/jpeg')
    expect(stripMimeParams('audio/mp4')).toBe('audio/mp4')
  })

  it('strips codec parameters emitted by MediaRecorder', () => {
    expect(stripMimeParams('audio/webm;codecs=opus')).toBe('audio/webm')
    expect(stripMimeParams('video/mp4; codecs="avc1.42E01E"')).toBe('video/mp4')
  })

  it('trims whitespace around the base type', () => {
    expect(stripMimeParams('  image/png ;charset=binary')).toBe('image/png')
  })

  it('falls back to the input when the base segment is empty', () => {
    expect(stripMimeParams(';codecs=opus')).toBe(';codecs=opus')
  })
})
