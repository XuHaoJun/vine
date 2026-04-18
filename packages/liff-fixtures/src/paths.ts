import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'

const require = createRequire(import.meta.url)

/**
 * Absolute path to `packages/liff-fixtures/dist` (built HTML/JS fixtures).
 * Run `bun run build --cwd packages/liff-fixtures` before serving from the server.
 */
export function getLiffFixturesDistDir(): string {
  const pkgRoot = dirname(require.resolve('@vine/liff-fixtures/package.json'))
  return join(pkgRoot, 'dist')
}
