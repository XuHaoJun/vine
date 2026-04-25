import { afterAll } from 'vitest'
import { drizzle } from 'drizzle-orm/node-postgres'
import { createPool, schema } from '@vine/db'

const DEFAULT_TEST_DATABASE_URL = 'postgresql://user:password@localhost:5533/postgres'
const ROLLBACK = Symbol('ROLLBACK')

let pool: ReturnType<typeof createPool> | undefined

function getDatabaseUrl(): string {
  return process.env['ZERO_UPSTREAM_DB'] ?? DEFAULT_TEST_DATABASE_URL
}

function getPool(): ReturnType<typeof createPool> {
  if (!pool) {
    pool = createPool(getDatabaseUrl())
  }
  return pool
}

export function getIntegrationDb() {
  return drizzle({ client: getPool(), schema, logger: false })
}

export async function withRollbackDb<T>(fn: (db: any) => Promise<T>): Promise<T> {
  const db = getIntegrationDb()
  let result: T | undefined

  try {
    await db.transaction(async (tx) => {
      result = await fn(tx)
      throw ROLLBACK
    })
  } catch (err) {
    if (err !== ROLLBACK) {
      throw err
    }
  }

  return result as T
}

export async function closeIntegrationDb(): Promise<void> {
  await pool?.end()
  pool = undefined
}

afterAll(async () => {
  await closeIntegrationDb()
})
