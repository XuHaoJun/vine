import { Pool } from 'pg'

const ZERO_UPSTREAM_DB = process.env['ZERO_UPSTREAM_DB'] ?? ''

let _database: Pool | undefined

export function getDatabase(): Pool {
  if (!_database) {
    if (!ZERO_UPSTREAM_DB) {
      throw new Error(`No db string connection found (ZERO_UPSTREAM_DB is not set)`)
    }
    _database = new Pool({
      connectionString: ZERO_UPSTREAM_DB,
      max: 20,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 5_000,
      allowExitOnIdle: true,
      ssl: ZERO_UPSTREAM_DB.includes('sslmode=require')
        ? { rejectUnauthorized: false }
        : undefined,
    })
    _database.on('error', (error) => {
      console.error(`[postgres] database error`, error)
    })
  }
  return _database
}

/** @deprecated Use getDatabase() for lazy initialization */
export const database = new Proxy({} as Pool, {
  get(_target, prop) {
    return (getDatabase() as any)[prop]
  },
})

// cleanup function that can be called during shutdown
export async function closeDatabase() {
  try {
    await database.end()
  } catch (error) {
    console.error(`[postgres] error closing database:`, error)
  }
}
