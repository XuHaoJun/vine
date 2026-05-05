import { loadEnv as vxrnLoadEnv } from 'vxrn/loadEnv'

import { getDockerHost } from './get-docker-host'
import { getIntegrationTestProxyPort } from '../integration-proxy'

export async function getTestEnv() {
  // load development environment
  await vxrnLoadEnv('development')

  const frontendPort = getIntegrationTestProxyPort()
  const dockerHost = getDockerHost()
  const dockerDbBase = `postgresql://user:password@127.0.0.1:5533`
  const frontendOrigin = `http://localhost:${frontendPort}`
  const dockerFrontendOrigin = `http://${dockerHost}:${frontendPort}`

  return {
    CI: 'true',
    DO_NOT_TRACK: '1',
    NODE_ENV: 'development',
    ZERO_LOG_LEVEL: process.env.DEBUG_BACKEND ? 'info' : 'warn',
    BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET || 'test-secret',
    BETTER_AUTH_URL: frontendOrigin,
    ONE_SERVER_URL: frontendOrigin,
    POSTMARK_SERVER_TOKEN: process.env.POSTMARK_SERVER_TOKEN || 'test-token',
    VITE_DEMO_MODE: '1',
    VITE_ZERO_HOSTNAME: '',
    VITE_WEB_HOSTNAME: '',
    ZERO_MUTATE_URL: `${dockerFrontendOrigin}/api/zero/push`,
    ZERO_QUERY_URL: `${dockerFrontendOrigin}/api/zero/pull`,
    ZERO_UPSTREAM_DB: `${dockerDbBase}/postgres`,
    ZERO_CVR_DB: `${dockerDbBase}/zero_cvr`,
    ZERO_CHANGE_DB: `${dockerDbBase}/zero_cdb`,
  }
}
