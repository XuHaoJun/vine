import { scryptAsync } from '@noble/hashes/scrypt.js'
import { bytesToHex, randomBytes } from '@noble/hashes/utils.js'
import { and, eq } from 'drizzle-orm'
import type { Pool } from 'pg'
import { randomUUID } from 'crypto'
import { existsSync, readFileSync } from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

import { user, account } from '../schema-private'
import { friendship, userPublic, userState, chat, chatMember, stickerPackage, entitlement } from '../schema-public'
import {
  oaProvider,
  officialAccount,
  oaRichMenu,
  oaRichMenuUserLink,
  oaDefaultRichMenu,
  oaFriendship,
} from '../schema-oa'
import { FLEX_SIMULATOR_OA_UNIQUE_ID } from '../constants'

const TEST_OA_UNIQUE_ID = 'testbot'
const TEST_OA_NAME = 'Test Bot'
const TEST_RICH_MENU_IMAGE_URL =
  'https://img2.pixhost.to/images/7292/716433745_gemini_generated_image_puffhnpuffhnpuff-edited.jpg'

const TEST_OA_RICH_MENU = {
  richMenuId: 'richmenu-testbot-default',
  name: 'Test Bot Menu',
  chatBarText: '功能選單',
  selected: false,
  sizeWidth: 2500,
  sizeHeight: 1686,
  areas: JSON.stringify([
    {
      bounds: { x: 0, y: 0, width: 1250, height: 1686 },
      action: { type: 'uri', uri: 'https://example.com/about' },
    },
    {
      bounds: { x: 1250, y: 0, width: 1250, height: 1686 },
      action: { type: 'message', text: 'hello' },
    },
  ]),
  hasImage: false,
}

type SeedDrive = {
  put(key: string, data: Buffer, mimeType?: string): Promise<void>
}

type RichMenuImageSource = {
  buffer: Buffer
  mimeType: string
  extension: 'jpg' | 'png'
}

export async function resolveTestRichMenuImageSource(
  fetchImpl: typeof fetch = fetch,
): Promise<RichMenuImageSource> {
  const response = await fetchImpl(TEST_RICH_MENU_IMAGE_URL)
  if (!response.ok) {
    throw new Error(
      `Failed to fetch rich menu image: ${response.status} ${response.statusText}`,
    )
  }

  const mimeType =
    response.headers.get('content-type')?.split(';')[0]?.trim() ?? 'image/jpeg'
  if (mimeType !== 'image/jpeg' && mimeType !== 'image/png') {
    throw new Error(`Unsupported rich menu image type: ${mimeType}`)
  }

  const extension = mimeType === 'image/png' ? 'png' : 'jpg'

  return {
    buffer: Buffer.from(await response.arrayBuffer()),
    mimeType,
    extension,
  }
}

const TEST_USERS = [
  { email: 'test1@example.com', name: 'Test One', username: 'test1' },
  { email: 'test2@example.com', name: 'Test Two', username: 'test2' },
  { email: 'test3@example.com', name: 'Test Three', username: 'test3' },
] as const

const STICKER_PACKAGE_SEEDS = [
  { id: 'pkg_cat_01', name: '貓咪日常', description: '', priceMinor: 75, stickerCount: 8 },
  { id: 'pkg_dog_01', name: '狗狗合集', description: '', priceMinor: 45, stickerCount: 8 },
  { id: 'pkg_bun_01', name: '兔兔聖誕限定', description: '', priceMinor: 129, stickerCount: 8 },
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

export function resolveStickerFixturesDir(
  moduleDir = path.dirname(fileURLToPath(import.meta.url)),
  cwd = process.cwd(),
): string {
  const candidates = [
    path.join(moduleDir, 'sticker-fixtures'),
    path.resolve(cwd, '../../packages/db/src/seed/sticker-fixtures'),
    path.resolve(cwd, 'packages/db/src/seed/sticker-fixtures'),
  ]

  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      return candidate
    }
  }

  throw new Error(
    `Sticker fixtures directory not found. Checked: ${candidates.join(', ')}`,
  )
}

export async function ensureSeed(pool: Pool, db: any, drive?: SeedDrive) {
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

  const existingFlexOA = await db
    .select()
    .from(officialAccount)
    .where(eq(officialAccount.uniqueId, FLEX_SIMULATOR_OA_UNIQUE_ID))
    .limit(1)

  if (existingFlexOA.length === 0) {
    const providerId = randomUUID()

    await db.insert(oaProvider).values({
      id: providerId,
      name: 'Vine Developers',
      ownerId: 'system',
      createdAt: now,
      updatedAt: now,
    })

    await db.insert(officialAccount).values({
      id: randomUUID(),
      providerId: providerId,
      name: 'Flex Message sim',
      uniqueId: FLEX_SIMULATOR_OA_UNIQUE_ID,
      description: 'Send Flex Messages to yourself for testing',
      channelSecret: bytesToHex(randomBytes(16)),
      status: 'active',
      createdAt: now,
      updatedAt: now,
    })

    console.info('[seed] Created Flex Message sim Official Account')
  } else {
    console.info('[seed] Flex Message sim Official Account already exists')
  }

  const existingTestOA = await db
    .select()
    .from(officialAccount)
    .where(eq(officialAccount.uniqueId, TEST_OA_UNIQUE_ID))
    .limit(1)

  let testOaId = existingTestOA[0]?.id

  if (existingTestOA.length === 0) {
    const testOaProviderId = randomUUID()

    await db.insert(oaProvider).values({
      id: testOaProviderId,
      name: 'Vine Test',
      ownerId: 'system',
      createdAt: now,
      updatedAt: now,
    })

    testOaId = randomUUID()

    await db.insert(officialAccount).values({
      id: testOaId,
      providerId: testOaProviderId,
      name: TEST_OA_NAME,
      uniqueId: TEST_OA_UNIQUE_ID,
      description: 'Integration test OA',
      channelSecret: bytesToHex(randomBytes(16)),
      status: 'active',
      createdAt: now,
      updatedAt: now,
    })

    console.info(`[seed] Created ${TEST_OA_NAME} Official Account`)
  } else {
    console.info(`[seed] ${TEST_OA_NAME} Official Account already exists`)
  }

  if (testOaId) {
    const existingTestRichMenu = await db
      .select()
      .from(oaRichMenu)
      .where(
        and(
          eq(oaRichMenu.oaId, testOaId),
          eq(oaRichMenu.richMenuId, TEST_OA_RICH_MENU.richMenuId),
        ),
      )
      .limit(1)

    if (existingTestRichMenu.length === 0) {
      await db.insert(oaRichMenu).values({
        id: randomUUID(),
        oaId: testOaId,
        richMenuId: TEST_OA_RICH_MENU.richMenuId,
        name: TEST_OA_RICH_MENU.name,
        chatBarText: TEST_OA_RICH_MENU.chatBarText,
        selected: TEST_OA_RICH_MENU.selected,
        sizeWidth: TEST_OA_RICH_MENU.sizeWidth,
        sizeHeight: TEST_OA_RICH_MENU.sizeHeight,
        areas: TEST_OA_RICH_MENU.areas,
        hasImage: TEST_OA_RICH_MENU.hasImage,
        createdAt: now,
        updatedAt: now,
      })
      console.info(`[seed] Created ${TEST_OA_NAME} default rich menu`)
    } else {
      console.info(`[seed] ${TEST_OA_NAME} default rich menu already exists`)
    }

    await db
      .insert(oaDefaultRichMenu)
      .values({
        oaId: testOaId,
        richMenuId: TEST_OA_RICH_MENU.richMenuId,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: oaDefaultRichMenu.oaId,
        set: {
          richMenuId: TEST_OA_RICH_MENU.richMenuId,
          updatedAt: now,
        },
      })

    if (drive) {
      try {
        const image = await resolveTestRichMenuImageSource()
        const richMenuKey = `richmenu/${testOaId}/${TEST_OA_RICH_MENU.richMenuId}.${image.extension}`
        await drive.put(richMenuKey, image.buffer, image.mimeType)
        await db
          .update(oaRichMenu)
          .set({ hasImage: true, updatedAt: now })
          .where(
            and(
              eq(oaRichMenu.oaId, testOaId),
              eq(oaRichMenu.richMenuId, TEST_OA_RICH_MENU.richMenuId),
            ),
          )
        console.info(
          `[seed] Ensured ${TEST_OA_NAME} rich menu image is available from ${TEST_RICH_MENU_IMAGE_URL}`,
        )
      } catch (error) {
        console.warn(`[seed] Failed to fetch ${TEST_OA_NAME} rich menu image`, error)
      }
    }
  }

  if (test1.length > 0) {
    const test1Id = test1[0].id

    const testOa = await db
      .select()
      .from(officialAccount)
      .where(eq(officialAccount.uniqueId, TEST_OA_UNIQUE_ID))
      .limit(1)

    if (testOa.length > 0) {
      const testOaId = testOa[0].id

      const existingOaFriendship = await db
        .select()
        .from(oaFriendship)
        .where(eq(oaFriendship.userId, test1Id))
        .limit(1)

      if (existingOaFriendship.length === 0) {
        await db.insert(oaFriendship).values({
          id: randomUUID(),
          oaId: testOaId,
          userId: test1Id,
          status: 'friend',
          createdAt: now,
        })

        const oaChatId = randomUUID()
        const oaMemberId = randomUUID()
        const userMemberId = randomUUID()

        await db.insert(chat).values({
          id: oaChatId,
          type: 'oa',
          createdAt: now,
        })

        await db.insert(chatMember).values([
          {
            id: oaMemberId,
            chatId: oaChatId,
            oaId: testOaId,
            joinedAt: now,
          },
          {
            id: userMemberId,
            chatId: oaChatId,
            userId: test1Id,
            joinedAt: now,
          },
        ])

        console.info(
          `[seed] Created OA friendship: test1 <-> ${TEST_OA_NAME} (chat: ${oaChatId})`,
        )
      } else {
        console.info(`[seed] OA friendship test1 <-> ${TEST_OA_NAME} already exists`)
      }
    }
  }

  await seedStickerPackages(db, drive)

  // Seed a pre-purchased entitlement for test1 so integration tests can
  // verify the sticker picker / chat flow without going through ECPay.
  const test1ForEntitlement = await db
    .select()
    .from(user)
    .where(eq(user.email, 'test1@example.com'))
    .limit(1)

  if (test1ForEntitlement.length > 0) {
    const test1Id = test1ForEntitlement[0].id
    const existingEntitlement = await db
      .select()
      .from(entitlement)
      .where(
        and(
          eq(entitlement.userId, test1Id),
          eq(entitlement.packageId, 'pkg_cat_01'),
        ),
      )
      .limit(1)

    if (existingEntitlement.length === 0) {
      await db.insert(entitlement).values({
        id: randomUUID(),
        userId: test1Id,
        packageId: 'pkg_cat_01',
        grantedByOrderId: 'seed-order-cat-01',
        grantedAt: now,
      })
      console.info(`[seed] Created entitlement for test1 -> pkg_cat_01`)
    } else {
      console.info(`[seed] Entitlement for test1 -> pkg_cat_01 already exists`)
    }
  }

  console.info('[seed] Seed data initialization complete')
}

async function seedStickerPackages(db: any, drive?: SeedDrive): Promise<void> {
  const now = new Date().toISOString()
  const fixturesDir = resolveStickerFixturesDir()
  for (const pkg of STICKER_PACKAGE_SEEDS) {
    const existing = await db
      .select()
      .from(stickerPackage)
      .where(eq(stickerPackage.id, pkg.id))
      .limit(1)

    if (existing.length === 0) {
      await db.insert(stickerPackage).values({
        id: pkg.id,
        name: pkg.name,
        description: pkg.description,
        priceMinor: pkg.priceMinor,
        currency: 'TWD',
        coverDriveKey: `stickers/${pkg.id}/cover.png`,
        tabIconDriveKey: `stickers/${pkg.id}/tab.png`,
        stickerCount: pkg.stickerCount,
        createdAt: now,
        updatedAt: now,
      })
      console.info(`[seed] created sticker package ${pkg.id}`)
    } else {
      console.info(`[seed] sticker package ${pkg.id} already exists`)
    }

    if (drive) {
      const base = path.join(fixturesDir, pkg.id)
      await putPng(drive, `stickers/${pkg.id}/cover.png`, path.join(base, 'cover.png'))
      await putPng(drive, `stickers/${pkg.id}/tab.png`, path.join(base, 'tab.png'))
      for (let i = 1; i <= pkg.stickerCount; i++) {
        await putPng(drive, `stickers/${pkg.id}/${i}.png`, path.join(base, `${i}.png`))
      }
    }
  }
}

async function putPng(drive: SeedDrive, key: string, file: string): Promise<void> {
  const buffer = readFileSync(file)
  await drive.put(key, buffer, 'image/png')
}
