import { describe, expect, it } from 'bun:test'

import {
  DEFAULT_FRONTEND_PORT,
  FRONTEND_PORT,
  getIntegrationTestProxyPort,
  getProxyTargetPort,
} from './integration-proxy.ts'

describe('getIntegrationTestProxyPort', () => {
  it('uses the default port when the env var is unset', () => {
    expect(getIntegrationTestProxyPort(undefined)).toBe(DEFAULT_FRONTEND_PORT)
    expect(FRONTEND_PORT).toBe(DEFAULT_FRONTEND_PORT)
  })

  it('uses INTEGRATION_TEST_PROXY_PORT when it is a valid integer', () => {
    expect(getIntegrationTestProxyPort('8181')).toBe(8181)
  })

  it('falls back to the default port when the env var is invalid', () => {
    expect(getIntegrationTestProxyPort('abc')).toBe(DEFAULT_FRONTEND_PORT)
    expect(getIntegrationTestProxyPort('0')).toBe(DEFAULT_FRONTEND_PORT)
  })
})

describe('getProxyTargetPort', () => {
  it('routes ConnectRPC method paths to the backend server', () => {
    expect(getProxyTargetPort('/oa.v1.OAService/ResolveOfficialAccount')).toBe(3001)
  })

  it('routes API and OAuth paths to the backend server', () => {
    expect(getProxyTargetPort('/api/auth/get-session')).toBe(3001)
    expect(getProxyTargetPort('/oauth2/v2.1/authorize')).toBe(3001)
  })

  it('routes page requests to the static frontend server', () => {
    expect(getProxyTargetPort('/oa/testbot')).toBe(9090)
    expect(getProxyTargetPort('/home/talks')).toBe(9090)
  })
})
