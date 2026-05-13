import { randomUUID } from 'crypto'
import {
  oaContactProfile,
  oaContactTag,
  oaContactTagAssignment,
  oaFriendship,
  oaProvider,
  officialAccount,
} from '@vine/db/schema-oa'
import { chat, chatMember, message, userPublic } from '@vine/db/schema-public'
import { describe, expect, it } from 'vitest'
import { withRollbackDb } from '../test/integration-db'
import { createOAContactExportService } from './oa-contact-export'

describe('OA contact CRM CSV export DB integration', () => {
  it('exports owner-visible friend CRM rows without chat message bodies', async () => {
    await withRollbackDb(async (db) => {
      const suffix = randomUUID()
      const exportedAt = new Date('2026-05-13T08:09:10.000Z')
      const ownerId = `owner-${suffix}`
      const friendId = `friend-${suffix}`
      const blockedId = `blocked-${suffix}`
      const chatId = `oa-export-chat-${suffix}`

      const [provider] = await db
        .insert(oaProvider)
        .values({ name: 'Provider', ownerId })
        .returning()
      const [account] = await db
        .insert(officialAccount)
        .values({
          providerId: provider.id,
          name: 'Export Bot',
          uniqueId: `export-${suffix}`,
          channelSecret: 'secret',
        })
        .returning()

      await db.insert(userPublic).values([
        { id: friendId, name: '=Formula Customer' },
        { id: blockedId, name: 'Blocked Customer' },
      ])
      await db.insert(oaFriendship).values([
        { oaId: account.id, userId: friendId, status: 'friend' },
        { oaId: account.id, userId: blockedId, status: 'blocked' },
      ])
      await db.insert(oaContactProfile).values({
        oaId: account.id,
        userId: friendId,
        noteText: '@Manager note, not public chat',
      })
      const [tag] = await db
        .insert(oaContactTag)
        .values({ oaId: account.id, name: '+VIP' })
        .returning()
      await db.insert(oaContactTagAssignment).values({
        oaId: account.id,
        userId: friendId,
        tagId: tag.id,
      })
      await db.insert(chat).values({
        id: chatId,
        type: 'oa',
        lastMessageAt: '2026-05-12T01:02:03.000Z',
      })
      await db.insert(chatMember).values([
        { id: `user-member-${suffix}`, chatId, userId: friendId },
        { id: `oa-member-${suffix}`, chatId, oaId: account.id },
      ])
      await db.insert(message).values({
        id: `message-${suffix}`,
        chatId,
        senderId: friendId,
        senderType: 'user',
        type: 'text',
        text: 'hello from chat',
        createdAt: '2026-05-12T01:02:03.000Z',
      })

      const service = createOAContactExportService({ db })

      await expect(
        service.exportContactsCsv({
          oaId: account.id,
          ownerId: `other-${suffix}`,
          exportedAt,
        }),
      ).resolves.toBeNull()

      const result = await service.exportContactsCsv({
        oaId: account.id,
        ownerId,
        exportedAt,
      })

      expect(result).not.toBeNull()
      expect(result!.filename).toBe(`oa-export-${suffix}-contacts-2026-05-13.csv`)
      expect(result!.csv).toContain('provider_scoped_user_id,display_name')
      expect(result!.csv).toContain(friendId)
      expect(result!.csv).toContain("'=Formula Customer")
      expect(result!.csv).toContain('active')
      expect(result!.csv).toContain("'+VIP")
      expect(result!.csv).toContain('"\'@Manager note, not public chat"')
      expect(result!.csv).toContain('2026-05-13T08:09:10.000Z')
      expect(result!.csv).not.toContain(blockedId)
      expect(result!.csv).not.toContain('hello from chat')
    })
  })
})
