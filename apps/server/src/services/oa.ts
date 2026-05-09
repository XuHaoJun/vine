import { createHmac, randomBytes, randomUUID } from 'crypto'
import { FLEX_SIMULATOR_OA_UNIQUE_ID } from '@vine/db/constants'
import {
  oaAccessToken,
  oaBusinessProfile,
  oaBusinessProfileDraft,
  oaDefaultRichMenu,
  oaFriendship,
  oaProvider,
  oaQuota,
  oaReplyToken,
  oaRichMenu,
  oaRichMenuAlias,
  oaRichMenuClick,
  oaRichMenuUserLink,
  oaWebhook,
  officialAccount,
} from '@vine/db/schema-oa'
import { chat, chatMember, message, userPublic } from '@vine/db/schema-public'
import { and, count, eq, ilike, inArray, lt, or, sql } from 'drizzle-orm'
import type { schema } from '@vine/db'
import type { NodePgDatabase } from 'drizzle-orm/node-postgres'
import type { Pool } from 'pg'

type OADeps = {
  db: NodePgDatabase<typeof schema>
  database: Pool
}

export function createOAService(deps: OADeps) {
  const { db } = deps

  async function createProvider(input: { name: string; ownerId: string }) {
    const [provider] = await db
      .insert(oaProvider)
      .values({
        name: input.name,
        ownerId: input.ownerId,
      })
      .returning()
    return provider
  }

  async function getProvider(id: string) {
    const [provider] = await db
      .select()
      .from(oaProvider)
      .where(eq(oaProvider.id, id))
      .limit(1)
    return provider ?? null
  }

  async function updateProvider(id: string, input: { name?: string }) {
    const [provider] = await db
      .update(oaProvider)
      .set({
        name: input.name,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(oaProvider.id, id))
      .returning()
    return provider
  }

  async function deleteProvider(id: string) {
    await db.delete(oaProvider).where(eq(oaProvider.id, id))
  }

  async function listProviderAccounts(providerId: string) {
    return db
      .select()
      .from(officialAccount)
      .where(eq(officialAccount.providerId, providerId))
  }

  async function listMyOfficialAccounts(ownerId: string) {
    return db
      .select({
        id: officialAccount.id,
        providerId: officialAccount.providerId,
        name: officialAccount.name,
        uniqueId: officialAccount.uniqueId,
        description: officialAccount.description,
        imageUrl: officialAccount.imageUrl,
        status: officialAccount.status,
        email: officialAccount.email,
        country: officialAccount.country,
        company: officialAccount.company,
        industry: officialAccount.industry,
        createdAt: officialAccount.createdAt,
        updatedAt: officialAccount.updatedAt,
      })
      .from(officialAccount)
      .innerJoin(oaProvider, eq(officialAccount.providerId, oaProvider.id))
      .where(eq(oaProvider.ownerId, ownerId))
  }

  async function listMyProviders(ownerId: string) {
    return db.select().from(oaProvider).where(eq(oaProvider.ownerId, ownerId))
  }

  function generateChannelSecret() {
    return randomBytes(32).toString('hex')
  }

  type BusinessProfilePatch = Partial<{
    displayName: string
    uniqueId: string
    statusMessage: string
    profileImageUrl: string | null
    coverImageUrl: string | null
    showFollowerCount: boolean
    footerButtonColor: string
    splashLabels: string[]
    buttons: unknown
    address: unknown
    phoneNumber: string | null
    paymentMethods: unknown
    businessHours: unknown
    websites: unknown
    visibilitySettings: unknown
    announcements: unknown
    mixedMediaFeed: unknown
    socialMedia: unknown
    basicInfoBlock: unknown
    blockOrder: string[]
  }>

  const DEFAULT_FOOTER_BUTTON_COLOR = '#06c755'

  const ALLOWED_FOOTER_COLORS = ['#06c755', '#9B95FF', '#FFBB00', '#FF6B6B', '#4DA6FF']

  const DEFAULT_BLOCK_ORDER = [
    'businessProfile',
    'announcements',
    'mixedMediaFeed',
    'socialMedia',
    'basicInfo',
  ] as const

  const VALID_BLOCK_IDS: Set<string> = new Set(DEFAULT_BLOCK_ORDER)

  const MAX_SPLASH_LABELS = 3

  function normalizeProfileImageUrl(value: string | null | undefined) {
    return value || null
  }

  function profileFromAccount(account: typeof officialAccount.$inferSelect) {
    return {
      oaId: account.id,
      displayName: account.name,
      uniqueId: account.uniqueId,
      statusMessage: account.description ?? '',
      profileImageUrl: normalizeProfileImageUrl(account.imageUrl),
      coverImageUrl: null,
      showFollowerCount: false,
      footerButtonColor: DEFAULT_FOOTER_BUTTON_COLOR,
      splashLabels: [],
      buttons: [{ type: 'chat', label: 'Chat', enabled: true }],
      address: {},
      phoneNumber: null,
      paymentMethods: [],
      businessHours: {},
      websites: [],
      visibilitySettings: {},
      announcements: { enabled: false, title: '', body: '', linkUrl: '' },
      mixedMediaFeed: { enabled: true },
      socialMedia: { enabled: false, links: [] },
      basicInfoBlock: { enabled: true },
      blockOrder: [...DEFAULT_BLOCK_ORDER],
    }
  }

  function draftValuesFromPublished(published: typeof oaBusinessProfile.$inferSelect) {
    return {
      oaId: published.oaId,
      displayName: published.displayName,
      uniqueId: published.uniqueId,
      statusMessage: published.statusMessage,
      profileImageUrl: published.profileImageUrl,
      coverImageUrl: published.coverImageUrl,
      showFollowerCount: published.showFollowerCount,
      footerButtonColor: published.footerButtonColor,
      splashLabels: published.splashLabels,
      buttons: published.buttons,
      address: published.address,
      phoneNumber: published.phoneNumber,
      paymentMethods: published.paymentMethods,
      businessHours: published.businessHours,
      websites: published.websites,
      visibilitySettings: published.visibilitySettings,
      announcements: published.announcements,
      mixedMediaFeed: published.mixedMediaFeed,
      socialMedia: published.socialMedia,
      basicInfoBlock: published.basicInfoBlock,
      blockOrder: published.blockOrder,
    }
  }

  function validateBusinessProfilePatch(patch: BusinessProfilePatch): Partial<typeof oaBusinessProfile.$inferInsert> {
    const clean: any = {}

    if (patch.displayName !== undefined) {
      const trimmed = patch.displayName.trim()
      if (trimmed.length === 0) throw new Error('displayName must not be empty')
      clean.displayName = trimmed
    }
    if (patch.uniqueId !== undefined) {
      const trimmed = patch.uniqueId.trim()
      if (trimmed.length === 0) throw new Error('uniqueId must not be empty')
      if (!/^[a-z0-9_]+$/.test(trimmed)) throw new Error('uniqueId must be lower-case alphanumeric with underscores')
      clean.uniqueId = trimmed
    }
    if (patch.statusMessage !== undefined) {
      clean.statusMessage = patch.statusMessage.trim().slice(0, 200)
    }
    if (patch.profileImageUrl !== undefined) {
      clean.profileImageUrl = patch.profileImageUrl || null
    }
    if (patch.coverImageUrl !== undefined) {
      clean.coverImageUrl = patch.coverImageUrl || null
    }
    if (patch.showFollowerCount !== undefined) {
      clean.showFollowerCount = patch.showFollowerCount
    }
    if (patch.footerButtonColor !== undefined) {
      if (!ALLOWED_FOOTER_COLORS.includes(patch.footerButtonColor)) {
        throw new Error('Invalid footer button color')
      }
      clean.footerButtonColor = patch.footerButtonColor
    }
    if (patch.splashLabels !== undefined) {
      const labels = patch.splashLabels.filter((l) => l.trim().length > 0)
      if (labels.length > MAX_SPLASH_LABELS) throw new Error('Too many splash labels')
      clean.splashLabels = labels
    }
    if (patch.buttons !== undefined) {
      clean.buttons = patch.buttons
    }
    if (patch.address !== undefined) {
      clean.address = patch.address
    }
    if (patch.phoneNumber !== undefined) {
      clean.phoneNumber = patch.phoneNumber || null
    }
    if (patch.paymentMethods !== undefined) {
      clean.paymentMethods = patch.paymentMethods
    }
    if (patch.businessHours !== undefined) {
      clean.businessHours = patch.businessHours
    }
    if (patch.websites !== undefined) {
      clean.websites = patch.websites
    }
    if (patch.visibilitySettings !== undefined) {
      clean.visibilitySettings = patch.visibilitySettings
    }
    if (patch.announcements !== undefined) {
      clean.announcements = patch.announcements
    }
    if (patch.mixedMediaFeed !== undefined) {
      clean.mixedMediaFeed = patch.mixedMediaFeed
    }
    if (patch.socialMedia !== undefined) {
      clean.socialMedia = patch.socialMedia
    }
    if (patch.basicInfoBlock !== undefined) {
      clean.basicInfoBlock = patch.basicInfoBlock
    }
    if (patch.blockOrder !== undefined) {
      for (const id of patch.blockOrder) {
        if (!VALID_BLOCK_IDS.has(id)) throw new Error(`Invalid block ID: ${id}`)
      }
      const deduped = [...new Set(patch.blockOrder)]
      if (deduped.length !== patch.blockOrder.length) throw new Error('Duplicate block IDs')
      clean.blockOrder = patch.blockOrder
    }
    return clean
  }

  function validateBusinessProfileDraftForPublish(draft: any) {
    if (!draft.displayName || draft.displayName.trim().length === 0) {
      throw new Error('displayName must not be empty')
    }
    if (!draft.uniqueId || draft.uniqueId.trim().length === 0) {
      throw new Error('uniqueId must not be empty')
    }
    if (!/^[a-z0-9_]+$/.test(draft.uniqueId)) {
      throw new Error('uniqueId must be lower-case alphanumeric with underscores')
    }
    if (draft.splashLabels && draft.splashLabels.length > MAX_SPLASH_LABELS) {
      throw new Error('Too many splash labels')
    }
  }

  async function createOfficialAccount(input: {
    providerId: string
    name: string
    uniqueId: string
    description?: string
    imageUrl?: string
    email?: string
    country?: string
    company?: string
    industry?: string
  }) {
    const [account] = await db
      .insert(officialAccount)
      .values({
        providerId: input.providerId,
        name: input.name,
        uniqueId: input.uniqueId,
        description: input.description,
        imageUrl: input.imageUrl,
        email: input.email,
        country: input.country,
        company: input.company,
        industry: input.industry,
        channelSecret: generateChannelSecret(),
      })
      .returning()
    return account
  }

  async function getOfficialAccount(id: string, store = db) {
    const [account] = await store
      .select()
      .from(officialAccount)
      .where(eq(officialAccount.id, id))
      .limit(1)
    return account ?? null
  }

  function profilesEqual(published: any, draft: any) {
    const keys = [
      'displayName',
      'uniqueId',
      'statusMessage',
      'profileImageUrl',
      'coverImageUrl',
      'showFollowerCount',
      'footerButtonColor',
      'splashLabels',
      'buttons',
      'address',
      'phoneNumber',
      'paymentMethods',
      'businessHours',
      'websites',
      'visibilitySettings',
      'announcements',
      'mixedMediaFeed',
      'socialMedia',
      'basicInfoBlock',
      'blockOrder',
    ]
    return keys.every((key) => JSON.stringify(published[key]) === JSON.stringify(draft[key]))
  }

  async function ensureBusinessProfileRows(oaId: string, store = db) {
    const account = await getOfficialAccount(oaId, store)
    if (!account) return null

    const [existingPublished] = await store
      .select()
      .from(oaBusinessProfile)
      .where(eq(oaBusinessProfile.oaId, oaId))
      .limit(1)

    const published =
      existingPublished ??
      (
        await store
          .insert(oaBusinessProfile)
          .values({
            ...profileFromAccount(account),
            publishedAt: new Date().toISOString(),
          })
          .returning()
      )[0]!

    const [existingDraft] = await store
      .select()
      .from(oaBusinessProfileDraft)
      .where(eq(oaBusinessProfileDraft.oaId, oaId))
      .limit(1)

    const draft =
      existingDraft ??
      (
        await store
          .insert(oaBusinessProfileDraft)
          .values({
            ...draftValuesFromPublished(published),
            serverRevision: 1,
            lastSavedAt: new Date().toISOString(),
          })
          .returning()
      )[0]!

    return { account, published, draft }
  }

  async function getBusinessProfileEditorState(oaId: string) {
    const rows = await ensureBusinessProfileRows(oaId)
    if (!rows) return null
    return {
      account: rows.account,
      published: rows.published,
      draft: rows.draft,
      isDirty: !profilesEqual(rows.published, rows.draft),
    }
  }

  async function autosaveBusinessProfileDraft(
    oaId: string,
    patch: BusinessProfilePatch,
    clientRevision?: number,
  ) {
    const rows = await ensureBusinessProfileRows(oaId)
    if (!rows) return null
    if (clientRevision !== undefined && clientRevision !== rows.draft.serverRevision) {
      throw new Error('draft revision conflict')
    }

    const now = new Date().toISOString()
    const validatedPatch = validateBusinessProfilePatch(patch)
    const [draft] = await db
      .update(oaBusinessProfileDraft)
      .set({
        ...validatedPatch,
        serverRevision: rows.draft.serverRevision + 1,
        lastSavedAt: now,
        updatedAt: now,
      })
      .where(eq(oaBusinessProfileDraft.oaId, oaId))
      .returning()

    return {
      account: rows.account,
      published: rows.published,
      draft: draft!,
      isDirty: !profilesEqual(rows.published, draft!),
    }
  }

  async function resetBusinessProfileDraft(oaId: string) {
    const rows = await ensureBusinessProfileRows(oaId)
    if (!rows) return null

    const now = new Date().toISOString()
    const [draft] = await db
      .update(oaBusinessProfileDraft)
      .set({
        displayName: rows.published.displayName,
        uniqueId: rows.published.uniqueId,
        statusMessage: rows.published.statusMessage,
        profileImageUrl: rows.published.profileImageUrl,
        coverImageUrl: rows.published.coverImageUrl,
        showFollowerCount: rows.published.showFollowerCount,
        footerButtonColor: rows.published.footerButtonColor,
        splashLabels: rows.published.splashLabels,
        buttons: rows.published.buttons,
        address: rows.published.address,
        phoneNumber: rows.published.phoneNumber,
        paymentMethods: rows.published.paymentMethods,
        businessHours: rows.published.businessHours,
        websites: rows.published.websites,
        visibilitySettings: rows.published.visibilitySettings,
        announcements: rows.published.announcements,
        mixedMediaFeed: rows.published.mixedMediaFeed,
        socialMedia: rows.published.socialMedia,
        basicInfoBlock: rows.published.basicInfoBlock,
        blockOrder: rows.published.blockOrder,
        serverRevision: rows.draft.serverRevision + 1,
        lastSavedAt: now,
        updatedAt: now,
      } as any)
      .where(eq(oaBusinessProfileDraft.oaId, oaId))
      .returning()

    return {
      account: rows.account,
      published: rows.published,
      draft: draft!,
      isDirty: false,
    }
  }

  async function publishBusinessProfile(oaId: string, expectedRevision?: number) {
    const now = new Date().toISOString()

    return db.transaction(async (tx) => {
      const rows = await ensureBusinessProfileRows(oaId, tx)
      if (!rows) return null
      const draft = rows.draft
      if (expectedRevision !== undefined && expectedRevision !== draft.serverRevision) {
        throw new Error('draft revision conflict')
      }
      validateBusinessProfileDraftForPublish(draft)

      const [existing] = await tx
        .select()
        .from(officialAccount)
        .where(eq(officialAccount.uniqueId, draft.uniqueId))
        .limit(1)
      if (existing && existing.id !== oaId) {
        throw new Error('uniqueId already exists')
      }

      const publishedValues = {
        displayName: draft.displayName,
        uniqueId: draft.uniqueId,
        statusMessage: draft.statusMessage,
        profileImageUrl: draft.profileImageUrl,
        coverImageUrl: draft.coverImageUrl,
        showFollowerCount: draft.showFollowerCount,
        footerButtonColor: draft.footerButtonColor,
        splashLabels: draft.splashLabels,
        buttons: draft.buttons,
        address: draft.address,
        phoneNumber: draft.phoneNumber,
        paymentMethods: draft.paymentMethods,
        businessHours: draft.businessHours,
        websites: draft.websites,
        visibilitySettings: draft.visibilitySettings,
        announcements: draft.announcements,
        mixedMediaFeed: draft.mixedMediaFeed,
        socialMedia: draft.socialMedia,
        basicInfoBlock: draft.basicInfoBlock,
        blockOrder: draft.blockOrder,
        publishedAt: now,
        updatedAt: now,
      }

      const [published] = await tx
        .update(oaBusinessProfile)
        .set(publishedValues)
        .where(eq(oaBusinessProfile.oaId, oaId))
        .returning()

      const [account] = await tx
        .update(officialAccount)
        .set({
          name: draft.displayName,
          uniqueId: draft.uniqueId,
          description: draft.statusMessage,
          imageUrl: draft.profileImageUrl,
          updatedAt: now,
        })
        .where(eq(officialAccount.id, oaId))
        .returning()

      return {
        account: account!,
        published: published!,
        draft,
        isDirty: false,
      }
    })
  }

  async function findOfficialAccountByUniqueId(uniqueId: string) {
    const [account] = await db
      .select({
        id: officialAccount.id,
        name: officialAccount.name,
        uniqueId: officialAccount.uniqueId,
        description: officialAccount.description,
        imageUrl: officialAccount.imageUrl,
      })
      .from(officialAccount)
      .where(eq(officialAccount.uniqueId, uniqueId))
      .limit(1)
    return account ?? null
  }

  async function getManagerSummary(oaId: string) {
    const account = await getOfficialAccount(oaId)
    if (!account) return null

    const [friendCountRow] = await db
      .select({ value: count() })
      .from(oaFriendship)
      .where(and(eq(oaFriendship.oaId, oaId), eq(oaFriendship.status, 'friend')))

    const webhook = await getWebhook(oaId)
    const richMenus = await getRichMenuList(oaId)
    const defaultRichMenu = await getDefaultRichMenu(oaId)
    const quota = await getQuota(oaId)

    const defaultRichMenuTitle = defaultRichMenu
      ? richMenus.find((menu) => menu.richMenuId === defaultRichMenu.richMenuId)?.name
      : undefined

    const [chatCountRow] = await db
      .select({ value: count() })
      .from(chat)
      .innerJoin(chatMember, eq(chatMember.chatId, chat.id))
      .where(and(eq(chat.type, 'oa'), eq(chatMember.oaId, oaId)))

    const chatCount = chatCountRow?.value ?? 0
    const profileComplete = Boolean(
      account.name && account.uniqueId && account.description,
    )
    const profileImageAdded = Boolean(account.imageUrl)
    const webhookConfigured = Boolean(webhook?.url)
    const defaultRichMenuCreated = Boolean(defaultRichMenu)

    return {
      account,
      friendCount: friendCountRow?.value ?? 0,
      chat: {
        status: chatCount > 0 ? 'available' : 'off',
        chatCount,
      },
      richMenu: {
        totalCount: richMenus.length,
        defaultRichMenuId: defaultRichMenu?.richMenuId,
        defaultRichMenuTitle,
      },
      webhook: {
        configured: webhookConfigured,
        useWebhook: webhook?.useWebhook ?? false,
        status: webhook?.status,
        lastVerifiedAt: webhook?.lastVerifiedAt ?? undefined,
        lastVerifyReason: webhook?.lastVerifyReason ?? undefined,
      },
      quota: {
        type: quota.type,
        monthlyLimit: quota.value,
        totalUsage: quota.totalUsage,
        remaining:
          quota.value === undefined
            ? undefined
            : Math.max(quota.value - quota.totalUsage, 0),
      },
      setup: {
        profileComplete,
        profileImageAdded,
        webhookConfigured,
        defaultRichMenuCreated,
        chatInboxAvailable: chatCount > 0,
      },
    }
  }

  async function updateOfficialAccount(
    id: string,
    input: { name?: string; description?: string; imageUrl?: string; status?: string },
  ) {
    const [account] = await db
      .update(officialAccount)
      .set({
        name: input.name,
        description: input.description,
        imageUrl: input.imageUrl,
        status: input.status,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(officialAccount.id, id))
      .returning()
    return account
  }

  async function deleteOfficialAccount(id: string) {
    await db.delete(officialAccount).where(eq(officialAccount.id, id))
  }

  async function setWebhook(oaId: string, url: string) {
    const [webhook] = await db
      .insert(oaWebhook)
      .values({
        oaId,
        url,
        status: 'pending',
      })
      .onConflictDoUpdate({
        target: oaWebhook.oaId,
        set: { url, status: 'pending', lastVerifiedAt: null },
      })
      .returning()
    return webhook
  }

  async function getWebhook(oaId: string) {
    const [webhook] = await db
      .select()
      .from(oaWebhook)
      .where(eq(oaWebhook.oaId, oaId))
      .limit(1)
    return webhook
  }

  function generateAccessToken() {
    return randomUUID().replace(/-/g, '') + randomBytes(16).toString('hex')
  }

  function generateKeyId() {
    return randomUUID()
  }

  async function issueAccessToken(input: {
    oaId: string
    type: 'short_lived' | 'jwt_v21'
    publicKey?: string
  }) {
    const token = generateAccessToken()
    const keyId = input.type === 'jwt_v21' ? generateKeyId() : undefined
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()

    await db.insert(oaAccessToken).values({
      oaId: input.oaId,
      token,
      type: input.type,
      keyId,
      expiresAt,
    })

    return {
      access_token: token,
      expires_in: 2592000,
      token_type: 'Bearer' as const,
      key_id: keyId,
    }
  }

  async function listAccessTokens(oaId: string, keyId?: string) {
    const conditions = [eq(oaAccessToken.oaId, oaId)]
    if (keyId) {
      conditions.push(eq(oaAccessToken.keyId, keyId))
    }
    return db
      .select({
        id: oaAccessToken.id,
        type: oaAccessToken.type,
        keyId: oaAccessToken.keyId,
        expiresAt: oaAccessToken.expiresAt,
        createdAt: oaAccessToken.createdAt,
      })
      .from(oaAccessToken)
      .where(and(...conditions))
  }

  async function revokeAccessToken(tokenId: string) {
    await db.delete(oaAccessToken).where(eq(oaAccessToken.id, tokenId))
  }

  async function revokeAllAccessTokens(oaId: string, keyId: string) {
    const result = await db
      .delete(oaAccessToken)
      .where(and(eq(oaAccessToken.oaId, oaId), eq(oaAccessToken.keyId, keyId)))
      .returning({ id: oaAccessToken.id })
    return { revoked_count: result.length }
  }

  function generateWebhookSignature(body: string, channelSecret: string) {
    return createHmac('SHA256', channelSecret).update(body).digest('base64')
  }

  function validateWebhookUrl(url: string): void {
    if (url.length > 500) {
      throw new Error('Webhook URL must be 500 characters or fewer')
    }
    let parsed: URL
    try {
      parsed = new URL(url)
    } catch {
      throw new Error('Webhook URL must be a valid HTTPS URL')
    }
    if (parsed.protocol !== 'https:') {
      throw new Error('Webhook URL must use HTTPS')
    }
  }

  async function updateWebhookSettings(
    oaId: string,
    input: {
      url?: string | undefined
      useWebhook?: boolean | undefined
      webhookRedeliveryEnabled?: boolean | undefined
      errorStatisticsEnabled?: boolean | undefined
    },
  ) {
    const [existing] = await db
      .select()
      .from(oaWebhook)
      .where(eq(oaWebhook.oaId, oaId))
      .limit(1)

    const values = {
      oaId,
      url: input.url ?? existing?.url ?? '',
      status:
        input.url && input.url !== existing?.url
          ? 'pending'
          : (existing?.status ?? 'pending'),
      useWebhook: input.useWebhook ?? existing?.useWebhook ?? true,
      webhookRedeliveryEnabled:
        input.webhookRedeliveryEnabled ?? existing?.webhookRedeliveryEnabled ?? false,
      errorStatisticsEnabled:
        input.errorStatisticsEnabled ?? existing?.errorStatisticsEnabled ?? false,
      lastVerifiedAt:
        input.url && input.url !== existing?.url
          ? null
          : (existing?.lastVerifiedAt ?? null),
      lastVerifyStatusCode:
        input.url && input.url !== existing?.url
          ? null
          : (existing?.lastVerifyStatusCode ?? null),
      lastVerifyReason:
        input.url && input.url !== existing?.url
          ? null
          : (existing?.lastVerifyReason ?? null),
    }

    if (!values.url) {
      throw new Error('Webhook URL is required')
    }
    validateWebhookUrl(values.url)

    const [webhook] = await db
      .insert(oaWebhook)
      .values(values)
      .onConflictDoUpdate({
        target: oaWebhook.oaId,
        set: values,
      })
      .returning()
    return webhook
  }

  async function recordWebhookVerifyResult(
    oaId: string,
    input: { statusCode: number; reason: string; verified: boolean },
  ) {
    const [webhook] = await db
      .update(oaWebhook)
      .set({
        status: input.verified ? 'verified' : 'failed',
        lastVerifiedAt: new Date().toISOString(),
        lastVerifyStatusCode: input.statusCode,
        lastVerifyReason: input.reason,
      })
      .where(eq(oaWebhook.oaId, oaId))
      .returning()
    return webhook
  }

  function generateReplyToken() {
    return randomUUID().replace(/-/g, '')
  }

  function buildMessageEvent(input: {
    oaId: string
    userId: string
    messageId: string
    text: string
    replyToken: string
  }) {
    return {
      destination: input.oaId,
      events: [
        {
          type: 'message',
          mode: 'active' as const,
          timestamp: Date.now(),
          source: { type: 'user' as const, userId: input.userId },
          webhookEventId: randomUUID(),
          deliveryContext: { isRedelivery: false },
          replyToken: input.replyToken,
          message: {
            type: 'text' as const,
            id: input.messageId,
            text: input.text,
          },
        },
      ],
    }
  }

  function buildFollowEvent(input: { oaId: string; userId: string; replyToken: string }) {
    return {
      destination: input.oaId,
      events: [
        {
          type: 'follow',
          mode: 'active' as const,
          timestamp: Date.now(),
          source: { type: 'user' as const, userId: input.userId },
          webhookEventId: randomUUID(),
          deliveryContext: { isRedelivery: false },
          replyToken: input.replyToken,
          follow: { isUnblocked: false },
        },
      ],
    }
  }

  function buildUnfollowEvent(input: { oaId: string; userId: string }) {
    return {
      destination: input.oaId,
      events: [
        {
          type: 'unfollow',
          mode: 'active' as const,
          timestamp: Date.now(),
          source: { type: 'user' as const, userId: input.userId },
          webhookEventId: randomUUID(),
          deliveryContext: { isRedelivery: false },
        },
      ],
    }
  }

  function buildPostbackEvent(input: {
    oaId: string
    userId: string
    replyToken: string
    data: string
    params?: { date?: string; time?: string; datetime?: string }
  }) {
    return {
      destination: input.oaId,
      events: [
        {
          type: 'postback' as const,
          mode: 'active' as const,
          timestamp: Date.now(),
          source: { type: 'user' as const, userId: input.userId },
          webhookEventId: randomUUID(),
          deliveryContext: { isRedelivery: false },
          replyToken: input.replyToken,
          postback: {
            data: input.data,
            ...(input.params ? { params: input.params } : {}),
          },
        },
      ],
    }
  }

  function buildRichMenuSwitchPostbackEvent(input: {
    oaId: string
    userId: string
    replyToken: string
    data: string
    newRichMenuAliasId: string
    status: 'SUCCESS' | 'RICHMENU_ALIAS_ID_NOTFOUND' | 'RICHMENU_NOTFOUND' | 'FAILED'
  }) {
    return {
      destination: input.oaId,
      events: [
        {
          type: 'postback' as const,
          mode: 'active' as const,
          timestamp: Date.now(),
          source: { type: 'user' as const, userId: input.userId },
          webhookEventId: randomUUID(),
          deliveryContext: { isRedelivery: false },
          replyToken: input.replyToken,
          postback: {
            data: input.data,
            params: {
              newRichMenuAliasId: input.newRichMenuAliasId,
              status: input.status,
            },
          },
        },
      ],
    }
  }

  async function searchOAs(query: string) {
    const searchPattern = `%${query}%`
    return db
      .select({
        id: officialAccount.id,
        name: officialAccount.name,
        uniqueId: officialAccount.uniqueId,
        description: officialAccount.description,
        imageUrl: officialAccount.imageUrl,
      })
      .from(officialAccount)
      .where(
        or(
          ilike(officialAccount.name, searchPattern),
          ilike(officialAccount.uniqueId, searchPattern),
        ),
      )
      .limit(20)
  }

  async function searchOAsForOwner(ownerId: string, query: string) {
    const searchPattern = `%${query}%`
    return db
      .select({
        id: officialAccount.id,
        name: officialAccount.name,
        uniqueId: officialAccount.uniqueId,
        description: officialAccount.description,
        imageUrl: officialAccount.imageUrl,
      })
      .from(officialAccount)
      .innerJoin(oaProvider, eq(officialAccount.providerId, oaProvider.id))
      .where(
        and(
          eq(oaProvider.ownerId, ownerId),
          or(
            ilike(officialAccount.name, searchPattern),
            ilike(officialAccount.uniqueId, searchPattern),
          ),
        ),
      )
      .limit(20)
  }

  async function recommendOfficialAccounts(limit: number = 15) {
    return db
      .select({
        id: officialAccount.id,
        name: officialAccount.name,
        uniqueId: officialAccount.uniqueId,
        description: officialAccount.description,
        imageUrl: officialAccount.imageUrl,
      })
      .from(officialAccount)
      .where(eq(officialAccount.status, 'active'))
      .orderBy(sql`RANDOM()`)
      .limit(limit)
  }

  async function addOAFriend(userId: string, oaId: string) {
    const account = await getOfficialAccount(oaId)
    if (!account) return { success: false, reason: 'oa_not_found' as const }

    const [existing] = await db
      .select()
      .from(oaFriendship)
      .where(and(eq(oaFriendship.oaId, account.id), eq(oaFriendship.userId, userId)))
      .limit(1)

    if (existing) return { success: false, reason: 'already_friend' as const }

    const [friendship] = await db
      .insert(oaFriendship)
      .values({
        oaId: account.id,
        userId,
        status: 'friend',
      })
      .returning()

    return {
      success: true as const,
      friendship,
      account,
    }
  }

  async function removeOAFriend(userId: string, oaId: string) {
    const account = await getOfficialAccount(oaId)
    if (!account) return { success: false, reason: 'oa_not_found' as const }

    await db
      .delete(oaFriendship)
      .where(and(eq(oaFriendship.oaId, account.id), eq(oaFriendship.userId, userId)))

    return { success: true as const }
  }

  async function listMyOAFriends(userId: string) {
    return db
      .select({
        id: oaFriendship.id,
        oaId: oaFriendship.oaId,
        uniqueId: officialAccount.uniqueId,
        name: officialAccount.name,
        imageUrl: officialAccount.imageUrl,
        status: oaFriendship.status,
        createdAt: oaFriendship.createdAt,
      })
      .from(oaFriendship)
      .innerJoin(officialAccount, eq(oaFriendship.oaId, officialAccount.id))
      .where(eq(oaFriendship.userId, userId))
  }

  async function isOAFriend(userId: string, oaId: string) {
    const account = await getOfficialAccount(oaId)
    if (!account) return false

    const [existing] = await db
      .select()
      .from(oaFriendship)
      .where(and(eq(oaFriendship.oaId, account.id), eq(oaFriendship.userId, userId)))
      .limit(1)

    return !!existing
  }

  async function simulatorSendFlexMessage(userId: string, flexJson: string) {
    const flexSimOA = await findOfficialAccountByUniqueId(FLEX_SIMULATOR_OA_UNIQUE_ID)
    if (!flexSimOA) {
      return { success: false, reason: 'oa_not_found' as const }
    }

    const [existingFriendship] = await db
      .select()
      .from(oaFriendship)
      .where(and(eq(oaFriendship.oaId, flexSimOA.id), eq(oaFriendship.userId, userId)))
      .limit(1)

    if (!existingFriendship) {
      return { success: false, reason: 'not_friend' as const }
    }

    const messageId = randomUUID()
    const sentAt = new Date().toISOString()

    const chatId = await db.transaction(async (tx) => {
      const userChatSubquery = tx
        .select({ chatId: chatMember.chatId })
        .from(chatMember)
        .where(eq(chatMember.userId, userId))

      const [existingChat] = await tx
        .select({ id: chat.id })
        .from(chat)
        .innerJoin(chatMember, eq(chatMember.chatId, chat.id))
        .where(
          and(
            eq(chat.type, 'oa'),
            inArray(chat.id, userChatSubquery),
            eq(chatMember.oaId, flexSimOA.id),
          ),
        )
        .limit(1)

      if (existingChat) {
        return existingChat.id
      }

      const newChatId = randomUUID()
      const now = new Date().toISOString()
      await tx.insert(chat).values({ id: newChatId, type: 'oa', createdAt: now })
      await tx.insert(chatMember).values([
        { id: randomUUID(), chatId: newChatId, userId, joinedAt: now },
        { id: randomUUID(), chatId: newChatId, oaId: flexSimOA.id, joinedAt: now },
      ])

      return newChatId
    })

    await db.insert(message).values({
      id: messageId,
      chatId,
      senderType: 'oa',
      oaId: flexSimOA.id,
      type: 'flex',
      metadata: flexJson,
      createdAt: sentAt,
    })

    await db
      .update(chat)
      .set({ lastMessageId: messageId, lastMessageAt: sentAt })
      .where(eq(chat.id, chatId))

    return { success: true as const, chatId }
  }

  async function sendOAMessage(
    oaId: string,
    userId: string,
    msg: {
      type: string
      text?: string | null
      metadata?: string | null
    },
  ) {
    const messageId = randomUUID()
    const sentAt = new Date().toISOString()

    const chatId = await db.transaction(async (tx) => {
      const userChatSubquery = tx
        .select({ chatId: chatMember.chatId })
        .from(chatMember)
        .where(eq(chatMember.userId, userId))

      const [existingChat] = await tx
        .select({ id: chat.id })
        .from(chat)
        .innerJoin(chatMember, eq(chatMember.chatId, chat.id))
        .where(
          and(
            eq(chat.type, 'oa'),
            inArray(chat.id, userChatSubquery),
            eq(chatMember.oaId, oaId),
          ),
        )
        .limit(1)

      if (existingChat) {
        return existingChat.id
      }

      const newChatId = randomUUID()
      const now = new Date().toISOString()
      await tx.insert(chat).values({ id: newChatId, type: 'oa', createdAt: now })
      await tx.insert(chatMember).values([
        { id: randomUUID(), chatId: newChatId, userId, joinedAt: now },
        { id: randomUUID(), chatId: newChatId, oaId, joinedAt: now },
      ])

      return newChatId
    })

    await db.insert(message).values({
      id: messageId,
      chatId,
      senderType: 'oa',
      oaId,
      type: msg.type as typeof message.$inferInsert.type,
      text: msg.text,
      metadata: msg.metadata,
      createdAt: sentAt,
    })

    await db
      .update(chat)
      .set({ lastMessageId: messageId, lastMessageAt: sentAt })
      .where(eq(chat.id, chatId))

    return { success: true as const, chatId, messageId }
  }

  async function getAccessTokenById(id: string) {
    const [row] = await db
      .select()
      .from(oaAccessToken)
      .where(eq(oaAccessToken.id, id))
      .limit(1)
    return row ?? null
  }

  async function verifyWebhook(oaId: string) {
    const webhook = await getWebhook(oaId)
    if (!webhook) return { success: false, status: 'no_webhook' as const }

    const account = await getOfficialAccount(oaId)
    if (!account) return { success: false, status: 'oa_not_found' as const }

    try {
      const response = await fetch(webhook.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'x-line-signature': generateWebhookSignature('[]', account.channelSecret),
        },
        body: JSON.stringify({ destination: oaId, events: [] }),
        signal: AbortSignal.timeout(10000),
      })

      if (response.ok) {
        await db
          .update(oaWebhook)
          .set({ status: 'verified', lastVerifiedAt: new Date().toISOString() })
          .where(eq(oaWebhook.oaId, oaId))
        return { success: true, status: 'verified' as const }
      }

      await db.update(oaWebhook).set({ status: 'failed' }).where(eq(oaWebhook.oaId, oaId))
      return { success: false, status: 'failed' as const }
    } catch {
      await db.update(oaWebhook).set({ status: 'failed' }).where(eq(oaWebhook.oaId, oaId))
      return { success: false, status: 'failed' as const }
    }
  }

  function generateRichMenuId() {
    return 'richmenu-' + randomUUID().replace(/-/g, '').substring(0, 32)
  }

  async function createRichMenu(input: {
    oaId: string
    name: string
    chatBarText: string
    selected: boolean
    sizeWidth: number
    sizeHeight: number
    areas: unknown[]
  }) {
    const richMenuId = generateRichMenuId()
    const [menu] = await db
      .insert(oaRichMenu)
      .values({
        oaId: input.oaId,
        richMenuId,
        name: input.name,
        chatBarText: input.chatBarText,
        selected: input.selected,
        sizeWidth: input.sizeWidth,
        sizeHeight: input.sizeHeight,
        areas: input.areas,
        hasImage: false,
      })
      .returning()
    return menu
  }

  async function updateRichMenu(
    oaId: string,
    richMenuId: string,
    input: {
      name: string
      chatBarText: string
      selected: boolean
      sizeWidth: number
      sizeHeight: number
      areas: unknown[]
    },
  ) {
    await db
      .update(oaRichMenu)
      .set({
        name: input.name,
        chatBarText: input.chatBarText,
        selected: input.selected,
        sizeWidth: input.sizeWidth,
        sizeHeight: input.sizeHeight,
        areas: input.areas,
        updatedAt: new Date().toISOString(),
      })
      .where(and(eq(oaRichMenu.oaId, oaId), eq(oaRichMenu.richMenuId, richMenuId)))
  }

  async function getRichMenu(oaId: string, richMenuId: string) {
    const [menu] = await db
      .select()
      .from(oaRichMenu)
      .where(and(eq(oaRichMenu.oaId, oaId), eq(oaRichMenu.richMenuId, richMenuId)))
      .limit(1)
    return menu ?? null
  }

  async function getRichMenuList(oaId: string) {
    return db.select().from(oaRichMenu).where(eq(oaRichMenu.oaId, oaId))
  }

  async function deleteRichMenu(oaId: string, richMenuId: string) {
    await db
      .delete(oaRichMenu)
      .where(and(eq(oaRichMenu.oaId, oaId), eq(oaRichMenu.richMenuId, richMenuId)))
  }

  async function setRichMenuImage(oaId: string, richMenuId: string, hasImage: boolean) {
    await db
      .update(oaRichMenu)
      .set({ hasImage, updatedAt: new Date().toISOString() })
      .where(and(eq(oaRichMenu.oaId, oaId), eq(oaRichMenu.richMenuId, richMenuId)))
  }

  async function setDefaultRichMenu(oaId: string, richMenuId: string) {
    await db
      .insert(oaDefaultRichMenu)
      .values({
        oaId,
        richMenuId,
        updatedAt: new Date().toISOString(),
      })
      .onConflictDoUpdate({
        target: oaDefaultRichMenu.oaId,
        set: { richMenuId, updatedAt: new Date().toISOString() },
      })
  }

  async function getDefaultRichMenu(oaId: string) {
    const [result] = await db
      .select()
      .from(oaDefaultRichMenu)
      .where(eq(oaDefaultRichMenu.oaId, oaId))
      .limit(1)
    return result ?? null
  }

  async function clearDefaultRichMenu(oaId: string) {
    await db.delete(oaDefaultRichMenu).where(eq(oaDefaultRichMenu.oaId, oaId))
  }

  async function linkRichMenuToUser(oaId: string, userId: string, richMenuId: string) {
    await db
      .insert(oaRichMenuUserLink)
      .values({
        oaId,
        userId,
        richMenuId,
      })
      .onConflictDoUpdate({
        target: [oaRichMenuUserLink.userId, oaRichMenuUserLink.oaId],
        set: { richMenuId, createdAt: new Date().toISOString() },
      })
  }

  async function unlinkRichMenuFromUser(oaId: string, userId: string) {
    await db
      .delete(oaRichMenuUserLink)
      .where(
        and(eq(oaRichMenuUserLink.oaId, oaId), eq(oaRichMenuUserLink.userId, userId)),
      )
  }

  async function unlinkAllRichMenuFromUsers(oaId: string) {
    await db.delete(oaRichMenuUserLink).where(eq(oaRichMenuUserLink.oaId, oaId))
  }

  async function getRichMenuIdOfUser(oaId: string, userId: string) {
    const [result] = await db
      .select()
      .from(oaRichMenuUserLink)
      .where(
        and(eq(oaRichMenuUserLink.oaId, oaId), eq(oaRichMenuUserLink.userId, userId)),
      )
      .limit(1)
    return result ?? null
  }

  async function createRichMenuAlias(input: {
    oaId: string
    richMenuAliasId: string
    richMenuId: string
  }) {
    const [alias] = await db
      .insert(oaRichMenuAlias)
      .values({
        oaId: input.oaId,
        richMenuAliasId: input.richMenuAliasId,
        richMenuId: input.richMenuId,
      })
      .returning()
    return alias
  }

  async function updateRichMenuAlias(input: {
    oaId: string
    richMenuAliasId: string
    richMenuId: string
  }) {
    const [alias] = await db
      .update(oaRichMenuAlias)
      .set({ richMenuId: input.richMenuId, updatedAt: new Date().toISOString() })
      .where(
        and(
          eq(oaRichMenuAlias.oaId, input.oaId),
          eq(oaRichMenuAlias.richMenuAliasId, input.richMenuAliasId),
        ),
      )
      .returning()
    return alias ?? null
  }

  async function deleteRichMenuAlias(oaId: string, richMenuAliasId: string) {
    await db
      .delete(oaRichMenuAlias)
      .where(
        and(
          eq(oaRichMenuAlias.oaId, oaId),
          eq(oaRichMenuAlias.richMenuAliasId, richMenuAliasId),
        ),
      )
  }

  async function getRichMenuAlias(oaId: string, richMenuAliasId: string) {
    const [alias] = await db
      .select()
      .from(oaRichMenuAlias)
      .where(
        and(
          eq(oaRichMenuAlias.oaId, oaId),
          eq(oaRichMenuAlias.richMenuAliasId, richMenuAliasId),
        ),
      )
      .limit(1)
    return alias ?? null
  }

  async function getRichMenuAliasList(oaId: string) {
    return db.select().from(oaRichMenuAlias).where(eq(oaRichMenuAlias.oaId, oaId))
  }

  async function addRichMenuClick(input: {
    oaId: string
    richMenuId: string
    areaIndex: number
  }) {
    await db.insert(oaRichMenuClick).values({
      oaId: input.oaId,
      richMenuId: input.richMenuId,
      areaIndex: input.areaIndex,
    })
  }

  async function getRichMenuClickStats(oaId: string, richMenuId: string) {
    const rows = await db
      .select({
        areaIndex: oaRichMenuClick.areaIndex,
        clickCount: sql<number>`cast(count(*) as int)`,
      })
      .from(oaRichMenuClick)
      .where(
        and(eq(oaRichMenuClick.oaId, oaId), eq(oaRichMenuClick.richMenuId, richMenuId)),
      )
      .groupBy(oaRichMenuClick.areaIndex)
    return rows
  }

  async function isUserChatMember(userId: string, chatId: string) {
    const [member] = await db
      .select({ id: chatMember.id })
      .from(chatMember)
      .where(and(eq(chatMember.chatId, chatId), eq(chatMember.userId, userId)))
      .limit(1)
    return Boolean(member)
  }

  async function listOAUsersWithRichMenus(input: {
    oaId: string
    richMenuId?: string | undefined
  }) {
    const conditions = [eq(oaFriendship.oaId, input.oaId)]
    if (input.richMenuId) {
      conditions.push(eq(oaRichMenuUserLink.richMenuId, input.richMenuId))
    }

    return db
      .select({
        userId: oaFriendship.userId,
        userName: userPublic.name,
        userImage: userPublic.image,
        assignedRichMenuId: oaRichMenuUserLink.richMenuId,
      })
      .from(oaFriendship)
      .leftJoin(
        oaRichMenuUserLink,
        and(
          eq(oaRichMenuUserLink.oaId, oaFriendship.oaId),
          eq(oaRichMenuUserLink.userId, oaFriendship.userId),
        ),
      )
      .leftJoin(userPublic, eq(userPublic.id, oaFriendship.userId))
      .where(and(...conditions))
  }

  function getStartOfMonth(): Date {
    const now = new Date()
    return new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0)
  }

  async function getQuota(oaId: string) {
    await resetIfNewMonth(oaId)
    const [row] = await db.select().from(oaQuota).where(eq(oaQuota.oaId, oaId)).limit(1)
    if (!row) {
      return { type: 'none' as const, value: undefined, totalUsage: 0 }
    }
    return {
      type: row.monthlyLimit > 0 ? ('limited' as const) : ('none' as const),
      value: row.monthlyLimit > 0 ? row.monthlyLimit : undefined,
      totalUsage: row.currentUsage,
    }
  }

  async function getConsumption(oaId: string) {
    await resetIfNewMonth(oaId)
    const [row] = await db.select().from(oaQuota).where(eq(oaQuota.oaId, oaId)).limit(1)
    return { totalUsage: row?.currentUsage ?? 0 }
  }

  async function resetIfNewMonth(oaId: string) {
    const [row] = await db.select().from(oaQuota).where(eq(oaQuota.oaId, oaId)).limit(1)
    if (!row) return

    const startOfMonth = getStartOfMonth()
    const resetAt = new Date(row.resetAt)

    if (resetAt < startOfMonth) {
      await db
        .update(oaQuota)
        .set({
          currentUsage: 0,
          resetAt: startOfMonth.toISOString(),
        })
        .where(eq(oaQuota.oaId, oaId))
    }
  }

  async function checkAndIncrementUsage(
    oaId: string,
    delta: number = 1,
  ): Promise<boolean> {
    await resetIfNewMonth(oaId)

    const [row] = await db.select().from(oaQuota).where(eq(oaQuota.oaId, oaId)).limit(1)

    if (!row || row.monthlyLimit === 0) {
      return true
    }

    const [updated] = await db
      .update(oaQuota)
      .set({ currentUsage: row.currentUsage + delta })
      .where(
        and(
          eq(oaQuota.oaId, oaId),
          sql`${oaQuota.currentUsage} + ${delta} <= ${row.monthlyLimit}`,
        ),
      )
      .returning()

    return !!updated
  }

  async function setQuota(oaId: string, monthlyLimit: number) {
    await db
      .insert(oaQuota)
      .values({
        oaId,
        monthlyLimit,
        currentUsage: 0,
        resetAt: getStartOfMonth().toISOString(),
      })
      .onConflictDoUpdate({
        target: oaQuota.oaId,
        set: { monthlyLimit },
      })
  }

  async function registerReplyToken(input: {
    oaId: string
    userId: string
    chatId: string
    messageId: string | null
  }) {
    const token = generateReplyToken()
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString()

    const [record] = await db
      .insert(oaReplyToken)
      .values({
        oaId: input.oaId,
        token,
        userId: input.userId,
        chatId: input.chatId,
        messageId: input.messageId,
        expiresAt,
      })
      .returning()
    return record
  }

  async function resolveReplyToken(token: string) {
    const [record] = await db
      .select()
      .from(oaReplyToken)
      .where(eq(oaReplyToken.token, token))
      .limit(1)

    if (!record) return { valid: false as const, reason: 'not_found' as const }
    if (record.used) return { valid: false as const, reason: 'already_used' as const }
    if (new Date(record.expiresAt) < new Date())
      return { valid: false as const, reason: 'expired' as const }

    return { valid: true as const, record }
  }

  async function markReplyTokenUsed(tokenId: string) {
    await db.update(oaReplyToken).set({ used: true }).where(eq(oaReplyToken.id, tokenId))
  }

  return {
    createProvider,
    getProvider,
    updateProvider,
    deleteProvider,
    listMyProviders,
    listProviderAccounts,
    listMyOfficialAccounts,
    createOfficialAccount,
    getOfficialAccount,
    getManagerSummary,
    getBusinessProfileEditorState,
    autosaveBusinessProfileDraft,
    resetBusinessProfileDraft,
    publishBusinessProfile,
    updateOfficialAccount,
    deleteOfficialAccount,
    setWebhook,
    getWebhook,
    issueAccessToken,
    listAccessTokens,
    revokeAccessToken,
    revokeAllAccessTokens,
    generateWebhookSignature,
    validateWebhookUrl,
    updateWebhookSettings,
    recordWebhookVerifyResult,
    generateReplyToken,
    buildMessageEvent,
    buildFollowEvent,
    buildUnfollowEvent,
    buildPostbackEvent,
    buildRichMenuSwitchPostbackEvent,
    searchOAs,
    searchOAsForOwner,
    recommendOfficialAccounts,
    addOAFriend,
    removeOAFriend,
    listMyOAFriends,
    isOAFriend,
    getAccessTokenById,
    verifyWebhook,
    findOfficialAccountByUniqueId,
    simulatorSendFlexMessage,
    sendOAMessage,
    createRichMenu,
    updateRichMenu,
    getRichMenu,
    getRichMenuList,
    deleteRichMenu,
    setRichMenuImage,
    setDefaultRichMenu,
    getDefaultRichMenu,
    clearDefaultRichMenu,
    linkRichMenuToUser,
    unlinkRichMenuFromUser,
    unlinkAllRichMenuFromUsers,
    getRichMenuIdOfUser,
    createRichMenuAlias,
    updateRichMenuAlias,
    deleteRichMenuAlias,
    getRichMenuAlias,
    getRichMenuAliasList,
    addRichMenuClick,
    getRichMenuClickStats,
    isUserChatMember,
    listOAUsersWithRichMenus,
    getQuota,
    getConsumption,
    checkAndIncrementUsage,
    setQuota,
    registerReplyToken,
    resolveReplyToken,
    markReplyTokenUsed,
  }
}

export type { OADeps }
