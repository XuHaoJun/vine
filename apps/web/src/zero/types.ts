import type { schema } from '@vine/zero-schema/schema'
import type { ServerActions } from '@vine/zero-schema/server/createServerActions'
import type { AuthData } from '~/features/auth/types'

type Schema = typeof schema

declare module 'on-zero' {
  interface Config {
    schema: Schema
    authData: AuthData
    serverActions: ServerActions
  }
}
