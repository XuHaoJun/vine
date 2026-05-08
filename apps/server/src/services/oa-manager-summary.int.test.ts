import { randomUUID } from 'crypto'
import {
  officialAccount,
  oaDefaultRichMenu,
  oaFriendship,
  oaProvider,
  oaQuota,
  oaRichMenu,
  oaWebhook,
} from '@vine/db/schema-oa'
import { chat, chatMember } from '@vine/db/schema-public'
import { describe, expect, it } from 'vitest'
import { withRollbackDb } from '../test/integration-db'
import { createOAService } from './oa'

describe('oa manager summary', () => {
  it('aggregates account, friend, webhook, quota, chat, and rich menu state', async () => {
    await withRollbackDb(async (db) => {
      const suffix = randomUUID()
      const [provider] = await db
        .insert(oaProvider)
        .values({ name: 'Provider', ownerId: 'owner-1' })
        .returning()
      const [account] = await db
        .insert(officialAccount)
        .values({
          providerId: provider.id,
          name: 'Test Bot',
          uniqueId: `summary-${suffix}`,
          description: 'Support account',
          imageUrl: 'https://example.com/bot.png',
          channelSecret: 'secret',
        })
        .returning()

      await db.insert(oaFriendship).values([
        { oaId: account.id, userId: 'user-1', status: 'friend' },
        { oaId: account.id, userId: 'user-2', status: 'friend' },
        { oaId: account.id, userId: 'user-3', status: 'blocked' },
      ])
      await db.insert(oaWebhook).values({
        oaId: account.id,
        url: 'https://example.com/webhook',
        status: 'verified',
        useWebhook: true,
        lastVerifiedAt: '2026-05-08T01:00:00.000Z',
        lastVerifyReason: 'ok',
      })
      await db.insert(oaRichMenu).values({
        oaId: account.id,
        richMenuId: 'richmenu-default',
        name: 'Default menu',
        chatBarText: 'Menu',
        selected: true,
        sizeWidth: 2500,
        sizeHeight: 843,
        areas: [],
        hasImage: true,
      })
      await db.insert(oaDefaultRichMenu).values({
        oaId: account.id,
        richMenuId: 'richmenu-default',
        updatedAt: new Date().toISOString(),
      })
      await db.insert(oaQuota).values({
        oaId: account.id,
        monthlyLimit: 1000,
        currentUsage: 25,
        resetAt: new Date().toISOString(),
      })
      await db.insert(chat).values({
        id: `oa-chat-${suffix}`,
        type: 'oa',
        createdAt: new Date().toISOString(),
      })
      await db.insert(chatMember).values({
        id: `oa-chat-member-${suffix}`,
        chatId: `oa-chat-${suffix}`,
        oaId: account.id,
        joinedAt: new Date().toISOString(),
      })

      const oa = createOAService({ db, database: {} as any })
      const summary = await oa.getManagerSummary(account.id)

      expect(summary).not.toBeNull()
      expect(summary!.account.name).toBe('Test Bot')
      expect(summary!.friendCount).toBe(2)
      expect(summary!.chat.recentChatCount).toBe(1)
      expect(summary!.chat.status).toBe('available')
      expect(summary!.webhook.configured).toBe(true)
      expect(summary!.webhook.status).toBe('verified')
      expect(summary!.richMenu.defaultRichMenuTitle).toBe('Default menu')
      expect(summary!.richMenu.totalCount).toBe(1)
      expect(summary!.quota.monthlyLimit).toBe(1000)
      expect(summary!.quota.totalUsage).toBe(25)
      expect(summary!.quota.remaining).toBe(975)
      expect(summary!.setup.profileComplete).toBe(true)
      expect(summary!.setup.profileImageAdded).toBe(true)
      expect(summary!.setup.webhookConfigured).toBe(true)
      expect(summary!.setup.defaultRichMenuCreated).toBe(true)
    })
  })
})
