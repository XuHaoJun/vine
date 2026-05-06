import { test, expect } from '@playwright/test'

const BASE_URL = 'http://localhost:3001'

test.describe('Mini App Service Messages', () => {
  // NOTE: Full end-to-end setup (create provider, login channel, LIFF app, mini app,
  // publish, add template, obtain tokens) requires authenticated console RPCs and
  // seed data. For integration-test parity with the existing API test suite, we
  // verify the public endpoint shape and error codes using the health endpoint as
  // a smoke test. A complete fixture-based scenario should be added once the M4
  // LIFF fixture suite is extended with Mini App helpers.

  test('notifier endpoint returns 401 without token', async ({ request }) => {
    const response = await request.post(`${BASE_URL}/api/oa/v2/mini-app/notifier/send`, {
      data: {
        liffAccessToken: 'fake',
        templateName: 'test',
        params: {},
      },
    })
    expect(response.status()).toBe(401)
    const body = await response.json()
    expect(body.error).toContain('Invalid or missing Login Channel access token')
  })

  test('notifier endpoint returns 401 with bad channel token', async ({ request }) => {
    const response = await request.post(`${BASE_URL}/api/oa/v2/mini-app/notifier/send`, {
      headers: { Authorization: 'Bearer bad-token' },
      data: {
        liffAccessToken: 'fake',
        templateName: 'test',
        params: {},
      },
    })
    expect(response.status()).toBe(401)
  })
})
