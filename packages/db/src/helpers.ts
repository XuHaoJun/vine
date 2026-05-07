import { createServerHelpers } from '@take-out/postgres'
import { getDatabase } from './database'

export const { sql, getDBClient } = createServerHelpers(getDatabase())
