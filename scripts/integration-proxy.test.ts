import { describe, expect, it } from 'bun:test'

import { getProxyTargetPort } from './integration-proxy.ts'

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
