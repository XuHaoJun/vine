import { scryptAsync } from '@noble/hashes/scrypt.js'
import { bytesToHex, randomBytes } from '@noble/hashes/utils.js'
import { eq } from 'drizzle-orm'
import type { Pool } from 'pg'
import { randomUUID } from 'crypto'

import { user, account } from '../schema-private'
import { friendship, userPublic, userState, chat, chatMember } from '../schema-public'

const TEST_USERS = [
  { email: 'test1@example.com', name: 'Test One', username: 'test1' },
  { email: 'test2@example.com', name: 'Test Two', username: 'test2' },
  { email: 'test3@example.com', name: 'Test Three', username: 'test3' },
] as const

const TEST_PASSWORD = 'test@1234'

const scryptConfig = { N: 16384, r: 16, p: 1, dkLen: 64 }

async function hashPassword(password: string): Promise<string> {
  const salt = bytesToHex(randomBytes(16))
  const key = await scryptAsync(password.normalize('NFKC'), salt, {
    ...scryptConfig,
    maxmem: 128 * scryptConfig.N * scryptConfig.r * 2,
  })
  return `${salt}:${bytesToHex(key)}`
}

const ALLOWED_DB_CREDENTIALS = ['postgres:postgres', 'user:password'] as const

function parseConnectionString(connStr: string): { user?: string; password?: string } {
  try {
    const url = new URL(connStr)
    return {
      user: url.username,
      password: url.password,
    }
  } catch {
    return {}
  }
}

function validateDbCredentials(connStr: string): boolean {
  const { user: dbUser } = parseConnectionString(connStr)
  return ALLOWED_DB_CREDENTIALS.some(
    (allowed) => connStr.includes(allowed) || dbUser === allowed.split(':')[0],
  )
}

export async function ensureSeed(pool: Pool, db: any) {
  const env = process.env['NODE_ENV']
  const demoMode = process.env['VITE_DEMO_MODE']
  const connStr = process.env['ZERO_UPSTREAM_DB'] ?? ''

  if (env !== 'development') {
    console.info('[seed] Skipped: NODE_ENV !== development')
    return
  }

  if (demoMode !== '1') {
    console.info('[seed] Skipped: VITE_DEMO_MODE !== 1')
    return
  }

  if (!validateDbCredentials(connStr)) {
    console.info('[seed] Blocked: Database credentials not in allowed list')
    console.info('[seed] Allowed: postgres:postgres or user:password')
    console.info('[seed] This prevents accidental seed data on production')
    return
  }

  console.info('[seed] Starting seed data initialization...')

  const now = new Date().toISOString()
  const passwordHash = await hashPassword(TEST_PASSWORD)

  for (const testUser of TEST_USERS) {
    const existingUser = await db
      .select()
      .from(user)
      .where(eq(user.email, testUser.email))
      .limit(1)

    if (existingUser.length > 0) {
      console.info(`[seed] User ${testUser.email} already exists, skipping`)
      continue
    }

    const userId = randomUUID()
    const accountId = randomUUID()

    await db.insert(user).values({
      id: userId,
      email: testUser.email,
      normalizedEmail: testUser.email.toLowerCase(),
      name: testUser.name,
      username: testUser.username,
      emailVerified: true,
      createdAt: now,
      updatedAt: now,
    })

    await db.insert(account).values({
      id: accountId,
      accountId: userId,
      providerId: 'credential',
      userId: userId,
      password: passwordHash,
      createdAt: now,
      updatedAt: now,
    })

    await db.insert(userPublic).values({
      id: userId,
      name: testUser.name,
      username: testUser.username,
      image: '',
      joinedAt: now,
    })

    await db.insert(userState).values({
      userId: userId,
      darkMode: false,
    })

    console.info(`[seed] Created user: ${testUser.email} (id: ${userId})`)
  }

  const test1 = await db
    .select()
    .from(user)
    .where(eq(user.email, 'test1@example.com'))
    .limit(1)
  const test2 = await db
    .select()
    .from(user)
    .where(eq(user.email, 'test2@example.com'))
    .limit(1)

  if (test1.length > 0 && test2.length > 0) {
    const test1Id = test1[0].id
    const test2Id = test2[0].id

    const existingFriendship = await db
      .select()
      .from(friendship)
      .where(eq(friendship.requesterId, test1Id))
      .limit(1)

    if (existingFriendship.length === 0) {
      const friendshipId = randomUUID()
      const chatId = randomUUID()
      const member1Id = randomUUID()
      const member2Id = randomUUID()

      await db.insert(friendship).values({
        id: friendshipId,
        requesterId: test1Id,
        addresseeId: test2Id,
        status: 'accepted',
        createdAt: now,
        updatedAt: now,
      })

      await db.insert(chat).values({
        id: chatId,
        type: 'direct',
        createdAt: now,
      })

      await db.insert(chatMember).values([
        {
          id: member1Id,
          chatId: chatId,
          userId: test1Id,
          joinedAt: now,
        },
        {
          id: member2Id,
          chatId: chatId,
          userId: test2Id,
          joinedAt: now,
        },
      ])

      console.info(`[seed] Created friendship: test1 <-> test2 (chat: ${chatId})`)
    } else {
      console.info('[seed] Friendship test1 <-> test2 already exists')
    }
  }

  console.info('[seed] Seed data initialization complete')
}
