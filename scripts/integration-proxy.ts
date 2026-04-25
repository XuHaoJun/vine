export const DEFAULT_FRONTEND_PORT = 8081
export const STATIC_PORT = 9090
export const BACKEND_PORT = 3001

export function getIntegrationTestProxyPort(
  rawPort = process.env.INTEGRATION_TEST_PROXY_PORT,
) {
  const parsedPort = Number(rawPort)
  if (Number.isInteger(parsedPort) && parsedPort > 0) {
    return parsedPort
  }
  return DEFAULT_FRONTEND_PORT
}

export const FRONTEND_PORT = getIntegrationTestProxyPort()

const CONNECT_RPC_PATH = /^\/[A-Za-z0-9_.-]+\.[A-Za-z0-9_.-]+\/[A-Z][A-Za-z0-9]*$/

export function isBackendProxyPath(pathname: string) {
  return (
    pathname.startsWith('/api') ||
    pathname.startsWith('/oauth2') ||
    pathname.startsWith('/liff/v1') ||
    pathname.startsWith('/fixtures/') ||
    CONNECT_RPC_PATH.test(pathname)
  )
}

export function getProxyTargetPort(pathname: string) {
  return isBackendProxyPath(pathname) ? BACKEND_PORT : STATIC_PORT
}
