/**
 * Augments the `on-zero` module with project-specific types.
 * This must be imported by any package/app that uses on-zero models.
 */
import type { schema } from './schema'
import type { createServerActions } from './server/createServerActions'
import type { AuthData } from './types'

type Schema = typeof schema
type ServerActions = ReturnType<typeof createServerActions>

declare module 'on-zero' {
  interface Config {
    schema: Schema
    authData: AuthData
    serverActions: ServerActions
  }
}
