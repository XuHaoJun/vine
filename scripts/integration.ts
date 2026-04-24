#!/usr/bin/env bun

/**
 * @description Simple integration test runner
 *
 * runs docker, waits for migrations, builds, starts server, runs playwright tests
 */

import { Socket } from 'node:net'
import { access, mkdir, rename, rm, writeFile } from 'node:fs/promises'
import { constants as fsConstants } from 'node:fs'
import path from 'node:path'
import { getTestEnv } from './helpers/get-test-env'
import {
  BACKEND_PORT,
  FRONTEND_PORT,
  STATIC_PORT,
  getProxyTargetPort,
} from './integration-proxy.ts'

// --- config ---
const DOCKER_TIMEOUT = 120_000 // 2 min
const BUILD_TIMEOUT = 300_000 // 5 min
const TEST_TIMEOUT = 120_000 // 2 min

// --- state ---
const processes: Bun.Subprocess[] = []
let proxyServer: ReturnType<typeof Bun.serve> | null = null

// --- helpers ---

async function $(cmd: string, opts?: { silent?: boolean; timeout?: number }) {
  if (!opts?.silent) console.info(`$ ${cmd}`)
  const proc = Bun.spawn(['bash', '-c', cmd], {
    stdout: 'inherit',
    stderr: 'inherit',
  })
  processes.push(proc)

  const timeoutMs = opts?.timeout || 60_000
  let timerId: ReturnType<typeof setTimeout>
  const timeoutPromise = new Promise<never>((_, reject) => {
    timerId = setTimeout(() => {
      proc.kill()
      reject(new Error(`command timed out after ${timeoutMs}ms: ${cmd}`))
    }, timeoutMs)
  })

  try {
    const exitCode = await Promise.race([proc.exited, timeoutPromise])
    if (exitCode !== 0) {
      throw new Error(`command failed with exit ${exitCode}: ${cmd}`)
    }
  } finally {
    clearTimeout(timerId!)
  }
}

async function spawn(cmd: string) {
  console.info(`$ ${cmd} &`)
  const proc = Bun.spawn(['bash', '-c', cmd], {
    stdout: 'inherit',
    stderr: 'inherit',
  })
  processes.push(proc)
  proc.unref()
  return proc
}

async function spawnWithEnv(cmd: string, env: Record<string, string>) {
  console.info(`$ ${cmd} &`)
  const proc = Bun.spawn(['bash', '-c', cmd], {
    stdout: 'inherit',
    stderr: 'inherit',
    env: { ...process.env, ...env },
  })
  processes.push(proc)
  proc.unref()
  return proc
}

function checkPort(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const sock = new Socket()
    sock.once('connect', () => {
      sock.destroy()
      resolve(true)
    })
    sock.once('error', () => resolve(false))
    sock.connect(port, '127.0.0.1')
  })
}

async function waitForPort(port: number, timeoutMs = 30_000) {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    if (await checkPort(port)) return
    await Bun.sleep(500)
  }
  throw new Error(`port ${port} not available after ${timeoutMs}ms`)
}

async function waitForMigrations(timeoutMs = DOCKER_TIMEOUT) {
  console.info('waiting for migrations...')
  const start = Date.now()

  while (Date.now() - start < timeoutMs) {
    try {
      const proc = Bun.spawn(
        ['docker', 'compose', 'ps', '--all', '--format', 'json', 'migrate'],
        { stdout: 'pipe', stderr: 'pipe' },
      )
      const text = await new Response(proc.stdout).text()
      await proc.exited

      const status = JSON.parse(text)
      if (status.State === 'exited') {
        if (status.ExitCode === 0) {
          console.info('migrations complete')
          return
        }
        throw new Error(`migrations failed with exit ${status.ExitCode}`)
      }
    } catch (err: unknown) {
      const message = String(err)
      if (!message.includes('JSON')) throw err
    }

    await Bun.sleep(1000)
  }

  throw new Error('migrations timed out')
}

async function ensureWritableVxrnCompilerCache() {
  const cacheDir = path.resolve('apps/web/node_modules/.vxrn/compiler-cache')
  const probeFile = path.join(cacheDir, `.write-test-${process.pid}`)

  try {
    await mkdir(cacheDir, { recursive: true })
    await writeFile(probeFile, '')
    await rm(probeFile, { force: true })
    return
  } catch (error) {
    const cause = error instanceof Error ? error.message : String(error)
    const staleDir = `${cacheDir}.stale-${Date.now()}`

    console.info(`resetting unwritable vxrn compiler cache: ${cause}`)
    await access(path.dirname(cacheDir), fsConstants.W_OK)
    await rename(cacheDir, staleDir)
    await mkdir(cacheDir, { recursive: true })
  }
}

async function cleanup() {
  console.info('\ncleaning up...')
  for (const p of processes) {
    try {
      p.kill()
    } catch {}
  }
  try {
    proxyServer?.stop(true)
  } catch {}
  try {
    Bun.spawn(['bash', '-c', 'docker compose kill; docker compose down -v'], {
      stdout: 'inherit',
      stderr: 'inherit',
    })
  } catch {}
}

// --- main ---

async function main() {
  console.info('integration test runner\n')

  // ensure port clear
  if (await checkPort(FRONTEND_PORT)) {
    console.error(`port ${FRONTEND_PORT} in use`)
    process.exit(1)
  }

  try {
    // clean start
    await $('docker compose down', { silent: true, timeout: 60_000 }).catch(() => {})

    // build migrations
    console.info('\nbuilding migrations...')
    await $('bun run tko migrate build', { timeout: BUILD_TIMEOUT })

    // start docker
    console.info('\nstarting docker...')
    await spawn('docker compose -f docker-compose.yml -f docker-compose.ci.yml up --remove-orphans pgdb migrate zero')
    await waitForMigrations()

    // install playwright
    console.info('\ninstalling playwright...')
    await $('bunx playwright install chromium', { timeout: BUILD_TIMEOUT })

    // build (bake VITE_DEMO_MODE into client bundle at build time)
    console.info('\nbuilding...')
    await ensureWritableVxrnCompilerCache()
    await $('VITE_DEMO_MODE=1 bun run build', { timeout: BUILD_TIMEOUT })

    // start backend
    console.info('\nstarting backend...')
    const commonEnv = await getTestEnv()
    await spawnWithEnv('bun --cwd apps/server start', commonEnv)
    await waitForPort(BACKEND_PORT, 30_000)

    // start static file server on internal port
    console.info('\nstarting frontend...')
    await spawnWithEnv(`bun --cwd apps/web one serve --port ${STATIC_PORT}`, commonEnv)
    await waitForPort(STATIC_PORT, 60_000)

    // start proxy on FRONTEND_PORT: routes /api/* to backend, everything else to static server
    // this keeps the browser on a single origin so auth cookies work without cross-origin CORS
    console.info(`\nstarting proxy on port ${FRONTEND_PORT}...`)
    proxyServer = Bun.serve({
      port: FRONTEND_PORT,
      async fetch(req) {
        const url = new URL(req.url)
        const targetPort = getProxyTargetPort(url.pathname)
        const target = `http://localhost:${targetPort}${url.pathname}${url.search}`

        // Disable compression so we can buffer and forward the body without re-encoding issues
        const reqHeaders = new Headers(req.headers)
        reqHeaders.set('accept-encoding', 'identity')

        const upstream = await fetch(target, {
          method: req.method,
          headers: reqHeaders,
          body: req.method !== 'GET' && req.method !== 'HEAD' ? req.body : undefined,
          redirect: 'manual',
        })

        // Pass through redirects directly to the browser
        if (upstream.status >= 300 && upstream.status < 400) {
          const resHeaders = new Headers(upstream.headers)
          return new Response(null, {
            status: upstream.status,
            headers: resHeaders,
          })
        }

        // Buffer the full body to avoid chunked transfer encoding issues with Bun.serve
        const body = await upstream.arrayBuffer()
        const resHeaders = new Headers(upstream.headers)
        resHeaders.delete('transfer-encoding')
        resHeaders.set('content-length', String(body.byteLength))

        return new Response(body, {
          status: upstream.status,
          headers: resHeaders,
        })
      },
    })
    console.info(`  ➜  Proxy:  http://localhost:${FRONTEND_PORT}/`)

    // run tests (optional args forwarded to playwright, e.g. integration/foo.test.ts)
    const playwrightExtra = process.argv.slice(2)
    const playwrightCmd =
      playwrightExtra.length > 0
        ? `bunx playwright test ${playwrightExtra.join(' ')}`
        : `bunx playwright test`
    console.info('\nrunning tests...')
    await $(`cd apps/web/src/test && ${playwrightCmd}`, { timeout: TEST_TIMEOUT })

    console.info('\n✓ integration tests passed')
  } finally {
    await cleanup()
  }
}

main().catch((err: unknown) => {
  console.error('\n✗ integration tests failed:', err instanceof Error ? err.message : err)
  process.exit(1)
})
