# Manager OA Profile and Basic Settings Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Phase 1 OA business profile editor with draft auto-save, manual publish, image upload, and published user-facing profile data.

**Architecture:** Add published and draft business profile tables under the OA schema, expose owner-only ConnectRPC manager methods, and implement a dedicated literal `account-page` editor route segment. Public OA profile surfaces read published profile data only and fall back to existing `officialAccount` fields for legacy accounts.

**Tech Stack:** Drizzle/Postgres migrations, ConnectRPC, Bun, Vitest, One, Tamagui, React Query, Playwright.

---

## File Structure

- Modify `packages/db/src/schema-oa.ts`: add `oaBusinessProfile` and `oaBusinessProfileDraft` tables.
- Create `packages/db/src/migrations/20260509000001_oa_business_profile.ts`: create/drop the profile tables.
- Modify `packages/proto/proto/oa/v1/oa.proto`: add business profile messages and RPCs.
- Regenerate `packages/proto/gen/oa/v1/oa_pb.ts`.
- Modify `apps/server/src/services/oa.ts`: add profile defaults, draft lifecycle, autosave, reset, publish, and image draft methods.
- Modify `apps/server/src/connect/oa.ts`: add proto mapping and RPC handlers.
- Add `apps/server/src/services/oa-business-profile.int.test.ts`: database-backed draft/publish behavior tests.
- Add `apps/server/src/connect/oa-business-profile.test.ts`: auth and handler contract tests.
- Add `apps/web/app/(app)/manager/[oaId]/account-page/_layout.tsx`: account-page local layout/header.
- Add `apps/web/app/(app)/manager/[oaId]/account-page/profile.tsx`: default profile editor route.
- Add `apps/web/src/features/oa-manager/profile/clientTypes.ts`: local UI types/helpers for generated profile messages.
- Add `apps/web/src/features/oa-manager/profile/useBusinessProfileEditor.ts`: query, autosave, reset, publish hooks.
- Add `apps/web/src/features/oa-manager/shared/ManagerOAAccountSwitcher.tsx`: reusable account switcher used by independent manager headers.
- Modify `apps/web/app/(app)/manager/[oaId]/(home)/_layout.tsx`: use the shared account switcher component without sharing the full header layout.
- Add `apps/web/src/features/oa-manager/profile/AccountPageHeader.tsx`: local header for account-page routes.
- Add `apps/web/src/features/oa-manager/profile/BusinessProfileEditor.tsx`: page shell with preview and editor.
- Add `apps/web/src/features/oa-manager/profile/BusinessProfilePreview.tsx`: left preview pane and block selection.
- Add `apps/web/src/features/oa-manager/profile/BusinessProfileForm.tsx`: right business profile form.
- Add `apps/web/src/features/oa-manager/profile/ProfileBlockEditors.tsx`: announcement/media/social/basic-info editors.
- Add `apps/web/src/features/oa-manager/profile/saveStatus.ts`: save/publish status labels.
- Modify `apps/web/src/features/oa-manager/home/ManagerOAHome.tsx`: route Edit profile to account-page editor.
- Modify `apps/web/src/interface/oa/OADetailContent.tsx`: replace mock public profile constants with published profile data.
- Add `apps/web/src/test/unit/features/oa-manager/saveStatus.test.ts`: status helper coverage.
- Add `apps/web/src/test/integration/manager-oa-profile.test.ts`: editor/public profile integration coverage.
- Modify `apps/web/src/test/integration/oa-detail.test.ts`: assert public profile uses real values.

## Task 1: Database Schema And Migration

**Files:**
- Modify: `packages/db/src/schema-oa.ts`
- Create: `packages/db/src/migrations/20260509000001_oa_business_profile.ts`
- Test: `apps/server/src/services/oa-business-profile.int.test.ts`

- [ ] **Step 1: Add failing integration test for profile draft lifecycle**

Create `apps/server/src/services/oa-business-profile.int.test.ts`:

```ts
import { randomUUID } from 'node:crypto'
import { withRollbackDb } from '../test/integration-db'
import { createOAService } from './oa'
import {
  oaBusinessProfile,
  oaBusinessProfileDraft,
  oaProvider,
  officialAccount,
} from '@vine/db/schema-oa'
import { eq } from 'drizzle-orm'
import { describe, expect, it } from 'vitest'

async function seedOA(db: any) {
  const suffix = randomUUID().slice(0, 8)
  const [provider] = await db
    .insert(oaProvider)
    .values({ name: `Profile Provider ${suffix}`, ownerId: `owner-${suffix}` })
    .returning()
  const [account] = await db
    .insert(officialAccount)
    .values({
      providerId: provider!.id,
      name: 'Profile Bot',
      uniqueId: `profilebot-${suffix}`,
      description: 'Published status',
      imageUrl: 'https://example.test/profile.png',
      channelSecret: 'secret',
      email: `profile-${suffix}@example.test`,
      country: 'TW',
      company: 'Profile Co',
      industry: 'Retail',
    })
    .returning()
  return account!
}

describe('oa business profile draft lifecycle', () => {
  it('creates missing published and draft rows from officialAccount', async () => {
    await withRollbackDb(async (db) => {
      const account = await seedOA(db)
      const oa = createOAService({ db, database: {} as any })

      const state = await oa.getBusinessProfileEditorState(account.id)

      expect(state.published.displayName).toBe('Profile Bot')
      expect(state.published.statusMessage).toBe('Published status')
      expect(state.draft.displayName).toBe('Profile Bot')
      expect(state.isDirty).toBe(false)

      const publishedRows = await db
        .select()
        .from(oaBusinessProfile)
        .where(eq(oaBusinessProfile.oaId, account.id))
      const draftRows = await db
        .select()
        .from(oaBusinessProfileDraft)
        .where(eq(oaBusinessProfileDraft.oaId, account.id))

      expect(publishedRows).toHaveLength(1)
      expect(draftRows).toHaveLength(1)
    })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
rtk bun scripts/integration.ts --db-only oa-business-profile.int.test.ts
```

Expected: FAIL because `oaBusinessProfile`, `oaBusinessProfileDraft`, and `getBusinessProfileEditorState` do not exist.

- [ ] **Step 3: Add Drizzle table definitions**

Modify `packages/db/src/schema-oa.ts` by adding these tables after `officialAccount`:

```ts
export const oaBusinessProfile = pgTable(
  'oaBusinessProfile',
  {
    oaId: uuid('oaId')
      .primaryKey()
      .references(() => officialAccount.id, { onDelete: 'cascade' }),
    displayName: text('displayName').notNull(),
    uniqueId: text('uniqueId').notNull(),
    statusMessage: text('statusMessage').notNull().default(''),
    profileImageUrl: text('profileImageUrl'),
    coverImageUrl: text('coverImageUrl'),
    showFollowerCount: boolean('showFollowerCount').notNull().default(false),
    footerButtonColor: text('footerButtonColor').notNull().default('#06c755'),
    splashLabels: text('splashLabels').array().notNull().default([]),
    buttons: jsonb('buttons').notNull().default([]),
    address: jsonb('address').notNull().default({}),
    phoneNumber: text('phoneNumber'),
    paymentMethods: jsonb('paymentMethods').notNull().default([]),
    businessHours: jsonb('businessHours').notNull().default({}),
    websites: jsonb('websites').notNull().default([]),
    visibilitySettings: jsonb('visibilitySettings').notNull().default({}),
    announcements: jsonb('announcements').notNull().default({}),
    mixedMediaFeed: jsonb('mixedMediaFeed').notNull().default({}),
    socialMedia: jsonb('socialMedia').notNull().default({}),
    basicInfoBlock: jsonb('basicInfoBlock').notNull().default({}),
    blockOrder: text('blockOrder').array().notNull().default([]),
    publishedAt: timestamp('publishedAt', { mode: 'string' }),
    createdAt: timestamp('createdAt', { mode: 'string' }).defaultNow().notNull(),
    updatedAt: timestamp('updatedAt', { mode: 'string' }).defaultNow().notNull(),
  },
  (table) => [index('oaBusinessProfile_uniqueId_idx').on(table.uniqueId)],
)

export const oaBusinessProfileDraft = pgTable('oaBusinessProfileDraft', {
  oaId: uuid('oaId')
    .primaryKey()
    .references(() => officialAccount.id, { onDelete: 'cascade' }),
  displayName: text('displayName').notNull(),
  uniqueId: text('uniqueId').notNull(),
  statusMessage: text('statusMessage').notNull().default(''),
  profileImageUrl: text('profileImageUrl'),
  coverImageUrl: text('coverImageUrl'),
  showFollowerCount: boolean('showFollowerCount').notNull().default(false),
  footerButtonColor: text('footerButtonColor').notNull().default('#06c755'),
  splashLabels: text('splashLabels').array().notNull().default([]),
  buttons: jsonb('buttons').notNull().default([]),
  address: jsonb('address').notNull().default({}),
  phoneNumber: text('phoneNumber'),
  paymentMethods: jsonb('paymentMethods').notNull().default([]),
  businessHours: jsonb('businessHours').notNull().default({}),
  websites: jsonb('websites').notNull().default([]),
  visibilitySettings: jsonb('visibilitySettings').notNull().default({}),
  announcements: jsonb('announcements').notNull().default({}),
  mixedMediaFeed: jsonb('mixedMediaFeed').notNull().default({}),
  socialMedia: jsonb('socialMedia').notNull().default({}),
  basicInfoBlock: jsonb('basicInfoBlock').notNull().default({}),
  blockOrder: text('blockOrder').array().notNull().default([]),
  serverRevision: integer('serverRevision').notNull().default(1),
  lastSavedAt: timestamp('lastSavedAt', { mode: 'string' }),
  createdAt: timestamp('createdAt', { mode: 'string' }).defaultNow().notNull(),
  updatedAt: timestamp('updatedAt', { mode: 'string' }).defaultNow().notNull(),
})
```

- [ ] **Step 4: Add migration**

Create `packages/db/src/migrations/20260509000001_oa_business_profile.ts`:

```ts
import type { PoolClient } from 'pg'

const sql = `
CREATE TABLE "oaBusinessProfile" (
  "oaId" uuid PRIMARY KEY REFERENCES "officialAccount"("id") ON DELETE CASCADE,
  "displayName" text NOT NULL,
  "uniqueId" text NOT NULL,
  "statusMessage" text NOT NULL DEFAULT '',
  "profileImageUrl" text,
  "coverImageUrl" text,
  "showFollowerCount" boolean NOT NULL DEFAULT false,
  "footerButtonColor" text NOT NULL DEFAULT '#06c755',
  "splashLabels" text[] NOT NULL DEFAULT '{}',
  "buttons" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "address" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "phoneNumber" text,
  "paymentMethods" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "businessHours" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "websites" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "visibilitySettings" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "announcements" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "mixedMediaFeed" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "socialMedia" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "basicInfoBlock" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "blockOrder" text[] NOT NULL DEFAULT '{}',
  "publishedAt" timestamptz,
  "createdAt" timestamptz DEFAULT now() NOT NULL,
  "updatedAt" timestamptz DEFAULT now() NOT NULL
);
CREATE INDEX "oaBusinessProfile_uniqueId_idx" ON "oaBusinessProfile"("uniqueId");

CREATE TABLE "oaBusinessProfileDraft" (
  "oaId" uuid PRIMARY KEY REFERENCES "officialAccount"("id") ON DELETE CASCADE,
  "displayName" text NOT NULL,
  "uniqueId" text NOT NULL,
  "statusMessage" text NOT NULL DEFAULT '',
  "profileImageUrl" text,
  "coverImageUrl" text,
  "showFollowerCount" boolean NOT NULL DEFAULT false,
  "footerButtonColor" text NOT NULL DEFAULT '#06c755',
  "splashLabels" text[] NOT NULL DEFAULT '{}',
  "buttons" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "address" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "phoneNumber" text,
  "paymentMethods" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "businessHours" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "websites" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "visibilitySettings" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "announcements" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "mixedMediaFeed" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "socialMedia" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "basicInfoBlock" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "blockOrder" text[] NOT NULL DEFAULT '{}',
  "serverRevision" integer NOT NULL DEFAULT 1,
  "lastSavedAt" timestamptz,
  "createdAt" timestamptz DEFAULT now() NOT NULL,
  "updatedAt" timestamptz DEFAULT now() NOT NULL
);
`

export async function up(client: PoolClient): Promise<void> {
  await client.query(sql)
}

export async function down(client: PoolClient): Promise<void> {
  await client.query(`
    DROP TABLE IF EXISTS "oaBusinessProfileDraft";
    DROP TABLE IF EXISTS "oaBusinessProfile";
  `)
}
```

- [ ] **Step 5: Run schema typecheck**

Run:

```bash
rtk bun run --cwd packages/db typecheck
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
rtk git add packages/db/src/schema-oa.ts packages/db/src/migrations/20260509000001_oa_business_profile.ts apps/server/src/services/oa-business-profile.int.test.ts
rtk git commit -m "feat(oa-manager): add business profile tables"
```

## Task 2: Server Service Draft And Publish Behavior

**Files:**
- Modify: `apps/server/src/services/oa.ts`
- Modify: `apps/server/src/services/oa-business-profile.int.test.ts`

- [ ] **Step 1: Extend failing service tests**

Append these tests to `apps/server/src/services/oa-business-profile.int.test.ts`:

```ts
it('autosaves draft without changing published profile or officialAccount', async () => {
  await withRollbackDb(async (db) => {
    const account = await seedOA(db)
    const oa = createOAService({ db, database: {} as any })

    await oa.getBusinessProfileEditorState(account.id)
    const saved = await oa.autosaveBusinessProfileDraft(account.id, {
      displayName: 'Draft Name',
      statusMessage: 'Draft status',
    })

    expect(saved.draft.displayName).toBe('Draft Name')
    expect(saved.isDirty).toBe(true)

    const [published] = await db
      .select()
      .from(oaBusinessProfile)
      .where(eq(oaBusinessProfile.oaId, account.id))
    const [freshAccount] = await db
      .select()
      .from(officialAccount)
      .where(eq(officialAccount.id, account.id))

    expect(published!.displayName).toBe('Profile Bot')
    expect(freshAccount!.name).toBe('Profile Bot')
  })
})

it('publishes draft and syncs officialAccount compatibility fields', async () => {
  await withRollbackDb(async (db) => {
    const account = await seedOA(db)
    const oa = createOAService({ db, database: {} as any })

    await oa.getBusinessProfileEditorState(account.id)
    const saved = await oa.autosaveBusinessProfileDraft(account.id, {
      displayName: 'Published Name',
      uniqueId: `published-${account.uniqueId}`,
      statusMessage: 'Published new status',
      profileImageUrl: 'https://example.test/new.png',
    })

    const published = await oa.publishBusinessProfile(account.id, saved.draft.serverRevision)

    expect(published.published.displayName).toBe('Published Name')
    expect(published.isDirty).toBe(false)

    const [freshAccount] = await db
      .select()
      .from(officialAccount)
      .where(eq(officialAccount.id, account.id))
    expect(freshAccount!.name).toBe('Published Name')
    expect(freshAccount!.uniqueId).toBe(`published-${account.uniqueId}`)
    expect(freshAccount!.description).toBe('Published new status')
    expect(freshAccount!.imageUrl).toBe('https://example.test/new.png')
  })
})

it('reset restores draft from published profile', async () => {
  await withRollbackDb(async (db) => {
    const account = await seedOA(db)
    const oa = createOAService({ db, database: {} as any })

    await oa.getBusinessProfileEditorState(account.id)
    await oa.autosaveBusinessProfileDraft(account.id, { displayName: 'Draft Name' })
    const reset = await oa.resetBusinessProfileDraft(account.id)

    expect(reset.draft.displayName).toBe('Profile Bot')
    expect(reset.isDirty).toBe(false)
  })
})
```

Also add failing tests for these branches before implementation:

- autosave rejects a stale `clientRevision`.
- publish rejects a stale `expectedRevision`.
- publish rejects duplicate `uniqueId`.
- autosave/publish rejects invalid footer color, more than 3 splash labels, invalid `blockOrder`, and invalid URL-bearing fields.
- publish is atomic: if the compatibility `officialAccount` update fails, the published profile row is unchanged.

- [ ] **Step 2: Run test to verify failure**

Run:

```bash
rtk bun scripts/integration.ts --db-only oa-business-profile.int.test.ts
```

Expected: FAIL because service methods are missing.

- [ ] **Step 3: Add service types and defaults**

Modify `apps/server/src/services/oa.ts` imports:

```ts
import {
  oaAccessToken,
  oaBusinessProfile,
  oaBusinessProfileDraft,
  oaDefaultRichMenu,
  oaFriendship,
  oaProvider,
  officialAccount,
} from '@vine/db/schema-oa'
```

Add these helpers near `generateChannelSecret()`:

```ts
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
const DEFAULT_BLOCK_ORDER = [
  'businessProfile',
  'announcements',
  'mixedMediaFeed',
  'socialMedia',
  'basicInfo',
] as const

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
```

- [ ] **Step 4: Add get/create helpers**

Add these functions inside `createOAService` after `getOfficialAccount`:

Update `getOfficialAccount` to accept an optional `store = db` parameter before
adding this helper, so `ensureBusinessProfileRows(oaId, tx)` stays fully inside
the publish transaction.

```ts
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
```

- [ ] **Step 4.5: Add validation helpers**

Add validation helpers before lifecycle methods:

- `draftValuesFromPublished(published)`: explicitly copies only columns shared by `oaBusinessProfileDraft`. Do not spread a published row into the draft insert because `publishedAt`, `createdAt`, and `updatedAt` do not have the same meaning.
- `validateBusinessProfilePatch(patch)`: validates only supplied fields before autosave.
- `validateBusinessProfileDraftForPublish(draft)`: validates the complete draft before publish.

Validation requirements:

- `displayName`: non-empty after trim, within the same max length used by current OA names.
- `uniqueId`: lower-case account ID format, non-empty, and duplicate checked on publish.
- `statusMessage`, `phoneNumber`, and URL-bearing JSON fields: bounded strings.
- `footerButtonColor`: one of the fixed LINE-like palette values used by the editor.
- `splashLabels`: max 3 labels; each label non-empty after trim.
- `blockOrder`: only known block IDs, no duplicates.
- JSON block fields: parseable object/array shapes expected by the editor, never raw strings.
- Image URLs: nullable string values produced by this server's drive URLs.

- [ ] **Step 5: Add lifecycle methods**

Add these functions inside `createOAService` after the helpers:

Important: the publish path must read the current draft and perform duplicate
`uniqueId`, published-row update, and `officialAccount` compatibility update
inside the same transaction. If `ensureBusinessProfileRows` is used in publish,
call it with the transaction handle or reread the draft inside the transaction.

```ts
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
      isDirty: !profilesEqual(rows.published, draft),
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
```

- [ ] **Step 6: Return new service methods**

Add these names to the object returned by `createOAService`:

```ts
    getBusinessProfileEditorState,
    autosaveBusinessProfileDraft,
    resetBusinessProfileDraft,
    publishBusinessProfile,
```

- [ ] **Step 7: Run integration test**

Run:

```bash
rtk bun scripts/integration.ts --db-only oa-business-profile.int.test.ts
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
rtk git add apps/server/src/services/oa.ts apps/server/src/services/oa-business-profile.int.test.ts
rtk git commit -m "feat(oa-manager): add business profile draft service"
```

## Task 3: Proto And ConnectRPC Handlers

**Files:**
- Modify: `packages/proto/proto/oa/v1/oa.proto`
- Modify generated: `packages/proto/gen/oa/v1/oa_pb.ts`
- Modify: `apps/server/src/connect/oa.ts`
- Create: `apps/server/src/connect/oa-business-profile.test.ts`

- [ ] **Step 1: Add failing handler tests**

Create `apps/server/src/connect/oa-business-profile.test.ts`:

```ts
import { Code } from '@connectrpc/connect'
import { createContextValues } from '@connectrpc/connect'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { connectAuthDataKey } from './auth-context'
import { oaHandler } from './oa'

vi.mock('@take-out/better-auth-utils/server', () => ({
  getAuthDataFromRequest: vi.fn(),
}))

import { getAuthDataFromRequest } from '@take-out/better-auth-utils/server'
const mockedGetAuthDataFromRequest = vi.mocked(getAuthDataFromRequest)

function makeAuthCtx(userId: string) {
  const values = createContextValues()
  values.set(connectAuthDataKey, { id: userId } as any)
  return {
    values,
    signal: new AbortController().signal,
    timeoutMs: undefined,
    method: {} as any,
    service: {} as any,
    requestMethod: 'POST',
    url: new URL('http://localhost/'),
    peer: { addr: '127.0.0.1' },
    requestHeader: new Headers(),
    responseHeader: new Headers(),
    responseTrailer: new Headers(),
  } as any
}

function makeProfile(displayName = 'Draft Bot') {
  return {
    oaId: 'oa-1',
    displayName,
    uniqueId: 'draftbot',
    statusMessage: 'Hello',
    profileImageUrl: '',
    coverImageUrl: '',
    showFollowerCount: false,
    footerButtonColor: '#06c755',
    splashLabels: [],
    buttons: [],
    address: {},
    phoneNumber: '',
    paymentMethods: [],
    businessHours: {},
    websites: [],
    visibilitySettings: {},
    announcements: {},
    mixedMediaFeed: {},
    socialMedia: {},
    basicInfoBlock: {},
    blockOrder: ['businessProfile'],
    serverRevision: 1,
    lastSavedAt: '2026-05-09T00:00:00Z',
    createdAt: '2026-05-09T00:00:00Z',
    updatedAt: '2026-05-09T00:00:00Z',
  }
}

function makeDeps(ownerId = 'user-1') {
  const account = {
    id: 'oa-1',
    providerId: 'provider-1',
    name: 'Test OA',
    uniqueId: 'test-oa',
    description: '',
    imageUrl: '',
    status: 'active',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    email: '',
    country: '',
    company: '',
    industry: '',
    channelSecret: 'secret',
  }
  const editorState = {
    account,
    published: makeProfile('Published Bot'),
    draft: makeProfile('Draft Bot'),
    isDirty: true,
  }
  const oa = {
    getOfficialAccount: vi.fn().mockResolvedValue(account),
    getProvider: vi.fn().mockResolvedValue({
      id: 'provider-1',
      name: 'Provider',
      ownerId,
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
    }),
    getBusinessProfileEditorState: vi.fn().mockResolvedValue(editorState),
    autosaveBusinessProfileDraft: vi.fn().mockResolvedValue(editorState),
    resetBusinessProfileDraft: vi.fn().mockResolvedValue({
      ...editorState,
      isDirty: false,
    }),
    publishBusinessProfile: vi.fn().mockResolvedValue({
      ...editorState,
      published: editorState.draft,
      isDirty: false,
    }),
  }
  const capturedImpl: any = {}
  const mockRouter = {
    service: (_desc: any, impl: any) => {
      Object.assign(capturedImpl, impl)
    },
  }
  oaHandler({
    oa: oa as any,
    auth: {} as any,
    drive: {
      put: vi.fn(),
      getUrl: vi.fn().mockResolvedValue('https://uploads.example/image.jpg'),
    } as any,
    webhookDelivery: {} as any,
  })(mockRouter as any)
  return { capturedImpl, oa }
}

beforeEach(() => {
  mockedGetAuthDataFromRequest.mockReset()
})

describe('oa business profile rpc', () => {
  it('returns editor state for an owner', async () => {
    mockedGetAuthDataFromRequest.mockResolvedValue({ id: 'user-1' } as any)
    const { capturedImpl } = makeDeps()
    const result = await capturedImpl.getBusinessProfileEditorState(
      { officialAccountId: 'oa-1' },
      makeAuthCtx('user-1'),
    )
    expect(result.draft?.displayName).toBe('Draft Bot')
    expect(result.isDirty).toBe(true)
  })

  it('rejects non-owner access', async () => {
    mockedGetAuthDataFromRequest.mockResolvedValue({ id: 'user-2' } as any)
    const { capturedImpl } = makeDeps('user-1')
    await expect(
      capturedImpl.getBusinessProfileEditorState(
        { officialAccountId: 'oa-1' },
        makeAuthCtx('user-2'),
      ),
    ).rejects.toMatchObject({ code: Code.PermissionDenied })
  })
})
```

- [ ] **Step 2: Run handler test to verify failure**

Run:

```bash
rtk bun run --cwd apps/server test:unit -- oa-business-profile.test.ts
```

Expected: FAIL because RPC methods and generated proto fields do not exist.

- [ ] **Step 3: Add proto messages**

Modify `packages/proto/proto/oa/v1/oa.proto` before `// -- Service --`:

```proto
enum BusinessProfileImageKind {
  BUSINESS_PROFILE_IMAGE_KIND_UNSPECIFIED = 0;
  BUSINESS_PROFILE_IMAGE_KIND_PROFILE = 1;
  BUSINESS_PROFILE_IMAGE_KIND_COVER = 2;
}

message BusinessProfileJson {
  string json = 1;
}

message BusinessProfileStringList {
  repeated string values = 1;
}

message BusinessProfile {
  string official_account_id = 1;
  string display_name = 2;
  string unique_id = 3;
  string status_message = 4;
  string profile_image_url = 5;
  string cover_image_url = 6;
  bool show_follower_count = 7;
  string footer_button_color = 8;
  repeated string splash_labels = 9;
  BusinessProfileJson buttons = 10;
  BusinessProfileJson address = 11;
  string phone_number = 12;
  BusinessProfileJson payment_methods = 13;
  BusinessProfileJson business_hours = 14;
  BusinessProfileJson websites = 15;
  BusinessProfileJson visibility_settings = 16;
  BusinessProfileJson announcements = 17;
  BusinessProfileJson mixed_media_feed = 18;
  BusinessProfileJson social_media = 19;
  BusinessProfileJson basic_info_block = 20;
  repeated string block_order = 21;
  int32 server_revision = 22;
  string last_saved_at = 23;
  string published_at = 24;
  string created_at = 25;
  string updated_at = 26;
}

message BusinessProfilePatch {
  optional string display_name = 1;
  optional string unique_id = 2;
  optional string status_message = 3;
  optional string profile_image_url = 4;
  optional string cover_image_url = 5;
  optional bool show_follower_count = 6;
  optional string footer_button_color = 7;
  optional BusinessProfileStringList splash_labels = 8;
  optional BusinessProfileJson buttons = 9;
  optional BusinessProfileJson address = 10;
  optional string phone_number = 11;
  optional BusinessProfileJson payment_methods = 12;
  optional BusinessProfileJson business_hours = 13;
  optional BusinessProfileJson websites = 14;
  optional BusinessProfileJson visibility_settings = 15;
  optional BusinessProfileJson announcements = 16;
  optional BusinessProfileJson mixed_media_feed = 17;
  optional BusinessProfileJson social_media = 18;
  optional BusinessProfileJson basic_info_block = 19;
  optional BusinessProfileStringList block_order = 20;
}

message GetBusinessProfileEditorStateRequest {
  string official_account_id = 1;
}

message GetBusinessProfileEditorStateResponse {
  OfficialAccount account = 1;
  BusinessProfile published = 2;
  BusinessProfile draft = 3;
  bool is_dirty = 4;
}

message AutosaveBusinessProfileDraftRequest {
  string official_account_id = 1;
  BusinessProfilePatch patch = 2;
  optional int32 client_revision = 3;
}

message AutosaveBusinessProfileDraftResponse {
  BusinessProfile draft = 1;
  int32 server_revision = 2;
  string saved_at = 3;
  bool is_dirty = 4;
}

message ResetBusinessProfileDraftRequest {
  string official_account_id = 1;
}

message ResetBusinessProfileDraftResponse {
  GetBusinessProfileEditorStateResponse state = 1;
}

message PublishBusinessProfileRequest {
  string official_account_id = 1;
  optional int32 expected_revision = 2;
}

message PublishBusinessProfileResponse {
  GetBusinessProfileEditorStateResponse state = 1;
}

message UploadBusinessProfileImageRequest {
  string official_account_id = 1;
  BusinessProfileImageKind kind = 2;
  bytes image = 3;
  string content_type = 4;
}

message UploadBusinessProfileImageResponse {
  BusinessProfile draft = 1;
  string image_url = 2;
  bool is_dirty = 3;
}

message RemoveBusinessProfileImageRequest {
  string official_account_id = 1;
  BusinessProfileImageKind kind = 2;
}

message RemoveBusinessProfileImageResponse {
  BusinessProfile draft = 1;
  bool is_dirty = 2;
}
```

Add RPCs to `service OAService` before rich menu RPCs:

```proto
  rpc GetBusinessProfileEditorState(GetBusinessProfileEditorStateRequest) returns (GetBusinessProfileEditorStateResponse);
  rpc AutosaveBusinessProfileDraft(AutosaveBusinessProfileDraftRequest) returns (AutosaveBusinessProfileDraftResponse);
  rpc ResetBusinessProfileDraft(ResetBusinessProfileDraftRequest) returns (ResetBusinessProfileDraftResponse);
  rpc PublishBusinessProfile(PublishBusinessProfileRequest) returns (PublishBusinessProfileResponse);
  rpc UploadBusinessProfileImage(UploadBusinessProfileImageRequest) returns (UploadBusinessProfileImageResponse);
  rpc RemoveBusinessProfileImage(RemoveBusinessProfileImageRequest) returns (RemoveBusinessProfileImageResponse);
```

- [ ] **Step 4: Generate proto**

Run:

```bash
rtk bun run --cwd packages/proto proto:generate
```

Expected: generated `packages/proto/gen/oa/v1/oa_pb.ts` includes new messages and service methods.

- [ ] **Step 5: Add handler mapping and RPCs**

Modify `apps/server/src/connect/oa.ts` imports:

```ts
import {
  AccessTokenType,
  BusinessProfileImageKind,
  OAService,
  OAStatus,
  WebhookStatus,
} from '@vine/proto/oa'
```

Add helpers near `toProtoOfficialAccount`:

```ts
function jsonField(value: unknown) {
  return { json: JSON.stringify(value ?? {}) }
}

function parseJsonField(field: { json?: string } | undefined) {
  if (!field?.json) return undefined
  return JSON.parse(field.json)
}

function toProtoBusinessProfile(db: any) {
  if (!db) return undefined
  return {
    officialAccountId: db.oaId,
    displayName: db.displayName,
    uniqueId: db.uniqueId,
    statusMessage: db.statusMessage ?? '',
    profileImageUrl: db.profileImageUrl ?? '',
    coverImageUrl: db.coverImageUrl ?? '',
    showFollowerCount: db.showFollowerCount,
    footerButtonColor: db.footerButtonColor,
    splashLabels: db.splashLabels ?? [],
    buttons: jsonField(db.buttons),
    address: jsonField(db.address),
    phoneNumber: db.phoneNumber ?? '',
    paymentMethods: jsonField(db.paymentMethods),
    businessHours: jsonField(db.businessHours),
    websites: jsonField(db.websites),
    visibilitySettings: jsonField(db.visibilitySettings),
    announcements: jsonField(db.announcements),
    mixedMediaFeed: jsonField(db.mixedMediaFeed),
    socialMedia: jsonField(db.socialMedia),
    basicInfoBlock: jsonField(db.basicInfoBlock),
    blockOrder: db.blockOrder ?? [],
    serverRevision: db.serverRevision ?? 0,
    lastSavedAt: db.lastSavedAt ?? '',
    publishedAt: db.publishedAt ?? '',
    createdAt: db.createdAt,
    updatedAt: db.updatedAt,
  }
}

function toEditorStateResponse(state: any) {
  return {
    account: toProtoOfficialAccount(state.account),
    published: toProtoBusinessProfile(state.published),
    draft: toProtoBusinessProfile(state.draft),
    isDirty: state.isDirty,
  }
}

function patchFromProto(patch: any) {
  return {
    displayName: patch.displayName,
    uniqueId: patch.uniqueId,
    statusMessage: patch.statusMessage,
    profileImageUrl: patch.profileImageUrl,
    coverImageUrl: patch.coverImageUrl,
    showFollowerCount: patch.showFollowerCount,
    footerButtonColor: patch.footerButtonColor,
    splashLabels: patch.splashLabels ? patch.splashLabels.values : undefined,
    buttons: parseJsonField(patch.buttons),
    address: parseJsonField(patch.address),
    phoneNumber: patch.phoneNumber,
    paymentMethods: parseJsonField(patch.paymentMethods),
    businessHours: parseJsonField(patch.businessHours),
    websites: parseJsonField(patch.websites),
    visibilitySettings: parseJsonField(patch.visibilitySettings),
    announcements: parseJsonField(patch.announcements),
    mixedMediaFeed: parseJsonField(patch.mixedMediaFeed),
    socialMedia: parseJsonField(patch.socialMedia),
    basicInfoBlock: parseJsonField(patch.basicInfoBlock),
    blockOrder: patch.blockOrder ? patch.blockOrder.values : undefined,
  }
}
```

Add handler methods inside the `OAService` implementation:

```ts
      async getBusinessProfileEditorState(req, ctx) {
        const auth = requireAuthData(ctx)
        await assertOfficialAccountOwnedByUser(deps, req.officialAccountId, auth.id)
        const state = await deps.oa.getBusinessProfileEditorState(req.officialAccountId)
        if (!state) throw new ConnectError('Official account not found', Code.NotFound)
        return toEditorStateResponse(state)
      },
      async autosaveBusinessProfileDraft(req, ctx) {
        const auth = requireAuthData(ctx)
        await assertOfficialAccountOwnedByUser(deps, req.officialAccountId, auth.id)
        const state = await deps.oa.autosaveBusinessProfileDraft(
          req.officialAccountId,
          patchFromProto(req.patch),
          req.clientRevision,
        )
        if (!state) throw new ConnectError('Official account not found', Code.NotFound)
        return {
          draft: toProtoBusinessProfile(state.draft),
          serverRevision: state.draft.serverRevision,
          savedAt: state.draft.lastSavedAt ?? '',
          isDirty: state.isDirty,
        }
      },
      async resetBusinessProfileDraft(req, ctx) {
        const auth = requireAuthData(ctx)
        await assertOfficialAccountOwnedByUser(deps, req.officialAccountId, auth.id)
        const state = await deps.oa.resetBusinessProfileDraft(req.officialAccountId)
        if (!state) throw new ConnectError('Official account not found', Code.NotFound)
        return { state: toEditorStateResponse(state) }
      },
      async publishBusinessProfile(req, ctx) {
        const auth = requireAuthData(ctx)
        await assertOfficialAccountOwnedByUser(deps, req.officialAccountId, auth.id)
        const state = await deps.oa.publishBusinessProfile(
          req.officialAccountId,
          req.expectedRevision,
        )
        if (!state) throw new ConnectError('Official account not found', Code.NotFound)
        return { state: toEditorStateResponse(state) }
      },
      async uploadBusinessProfileImage(req, ctx) {
        const auth = requireAuthData(ctx)
        await assertOfficialAccountOwnedByUser(deps, req.officialAccountId, auth.id)
        const baseMime = req.contentType.split(';')[0]?.trim() ?? req.contentType
        if (!['image/jpeg', 'image/png'].includes(baseMime)) {
          throw new ConnectError('Unsupported image type', Code.InvalidArgument)
        }
        const isCover = req.kind === BusinessProfileImageKind.COVER
        const maxBytes = isCover ? 10 * 1024 * 1024 : 3 * 1024 * 1024
        if (req.image.length > maxBytes) {
          throw new ConnectError('Image is too large', Code.InvalidArgument)
        }
        const ext = baseMime === 'image/png' ? 'png' : 'jpg'
        const kind =
          isCover ? 'cover' : 'profile'
        const key = `oa-profile/${req.officialAccountId}/${kind}.${ext}`
        await deps.drive.put(key, Buffer.from(req.image), baseMime)
        const imageUrl = await deps.drive.getUrl(key)
        const patch =
          kind === 'cover' ? { coverImageUrl: imageUrl } : { profileImageUrl: imageUrl }
        const state = await deps.oa.autosaveBusinessProfileDraft(
          req.officialAccountId,
          patch,
        )
        if (!state) throw new ConnectError('Official account not found', Code.NotFound)
        return {
          draft: toProtoBusinessProfile(state.draft),
          imageUrl,
          isDirty: state.isDirty,
        }
      },
      async removeBusinessProfileImage(req, ctx) {
        const auth = requireAuthData(ctx)
        await assertOfficialAccountOwnedByUser(deps, req.officialAccountId, auth.id)
        const patch =
          req.kind === BusinessProfileImageKind.COVER
            ? { coverImageUrl: null }
            : { profileImageUrl: null }
        const state = await deps.oa.autosaveBusinessProfileDraft(
          req.officialAccountId,
          patch,
        )
        if (!state) throw new ConnectError('Official account not found', Code.NotFound)
        return { draft: toProtoBusinessProfile(state.draft), isDirty: state.isDirty }
      },
```

- [ ] **Step 6: Run handler tests**

Run:

```bash
rtk bun run --cwd apps/server test:unit -- oa-business-profile.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
rtk git add packages/proto/proto/oa/v1/oa.proto packages/proto/gen/oa/v1/oa_pb.ts apps/server/src/connect/oa.ts apps/server/src/connect/oa-business-profile.test.ts
rtk git commit -m "feat(oa-manager): expose business profile rpc"
```

## Task 4: Account-page Route And Editor Shell

**Files:**
- Create: `apps/web/app/(app)/manager/[oaId]/account-page/_layout.tsx`
- Create: `apps/web/app/(app)/manager/[oaId]/account-page/profile.tsx`
- Create: `apps/web/src/features/oa-manager/profile/clientTypes.ts`
- Create: `apps/web/src/features/oa-manager/profile/saveStatus.ts`
- Create: `apps/web/src/features/oa-manager/profile/useBusinessProfileEditor.ts`
- Create: `apps/web/src/features/oa-manager/shared/ManagerOAAccountSwitcher.tsx`
- Create: `apps/web/src/features/oa-manager/profile/AccountPageHeader.tsx`
- Create: `apps/web/src/features/oa-manager/profile/BusinessProfileEditor.tsx`
- Create: `apps/web/src/features/oa-manager/profile/BusinessProfilePreview.tsx`
- Create: `apps/web/src/features/oa-manager/profile/BusinessProfileForm.tsx`
- Create: `apps/web/src/features/oa-manager/profile/ProfileBlockEditors.tsx`
- Add test: `apps/web/src/test/unit/features/oa-manager/saveStatus.test.ts`

- [ ] **Step 1: Add failing status helper test**

Create `apps/web/src/test/unit/features/oa-manager/saveStatus.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { getBusinessProfileSaveStatus } from '~/features/oa-manager/profile/saveStatus'

describe('getBusinessProfileSaveStatus', () => {
  it('shows published state when there are no draft changes', () => {
    expect(
      getBusinessProfileSaveStatus({
        isSaving: false,
        isError: false,
        isDirty: false,
      }),
    ).toEqual({ label: 'All changes have been published.', tone: 'success' })
  })

  it('prioritizes saving and error states', () => {
    expect(
      getBusinessProfileSaveStatus({
        isSaving: true,
        isError: false,
        isDirty: true,
      }).label,
    ).toBe('Saving changes...')
    expect(
      getBusinessProfileSaveStatus({
        isSaving: false,
        isError: true,
        isDirty: true,
      }).label,
    ).toBe('Save failed')
  })
})
```

- [ ] **Step 2: Run status test to verify failure**

Run:

```bash
rtk bun run --cwd apps/web test:unit -- saveStatus.test.ts
```

Expected: FAIL because helper does not exist.

- [ ] **Step 3: Add save status helper**

Create `apps/web/src/features/oa-manager/profile/saveStatus.ts`:

```ts
export type BusinessProfileSaveStatusInput = {
  isSaving: boolean
  isError: boolean
  isDirty: boolean
}

export function getBusinessProfileSaveStatus(input: BusinessProfileSaveStatusInput) {
  if (input.isSaving) return { label: 'Saving changes...', tone: 'muted' as const }
  if (input.isError) return { label: 'Save failed', tone: 'danger' as const }
  if (input.isDirty) return { label: 'Changes saved', tone: 'success' as const }
  return { label: 'All changes have been published.', tone: 'success' as const }
}
```

- [ ] **Step 4: Add client type helpers**

Create `apps/web/src/features/oa-manager/profile/clientTypes.ts`:

```ts
import type { BusinessProfile } from '@vine/proto/oa'

export function parseProfileJson<T>(field: { json?: string } | undefined, fallback: T): T {
  if (!field?.json) return fallback
  try {
    return JSON.parse(field.json) as T
  } catch {
    return fallback
  }
}

export function makeProfileJson(value: unknown) {
  return { json: JSON.stringify(value ?? {}) }
}

export type EditorSection =
  | 'businessProfile'
  | 'announcements'
  | 'mixedMediaFeed'
  | 'socialMedia'
  | 'basicInfo'

export type DraftProfile = BusinessProfile
```

- [ ] **Step 5: Add editor hook**

Create `apps/web/src/features/oa-manager/profile/useBusinessProfileEditor.ts`:

```ts
import { useCallback, useMemo, useState } from 'react'
import { oaClient } from '~/features/oa/client'
import { useTanMutation, useTanQuery, useTanQueryClient } from '~/query'
import { makeProfileJson } from './clientTypes'
import type { BusinessProfilePatch } from '@vine/proto/oa'

export function useBusinessProfileEditor(oaId: string) {
  const queryClient = useTanQueryClient()
  const queryKey = useMemo(() => ['oa', 'business-profile-editor', oaId], [oaId])
  const [saveError, setSaveError] = useState(false)

  const editor = useTanQuery({
    queryKey,
    queryFn: () => oaClient.getBusinessProfileEditorState({ officialAccountId: oaId }),
    enabled: !!oaId,
  })

  const autosave = useTanMutation({
    mutationFn: (patch: BusinessProfilePatch) =>
      oaClient.autosaveBusinessProfileDraft({
        officialAccountId: oaId,
        patch,
        clientRevision: editor.data?.draft?.serverRevision,
      }),
    onMutate: () => setSaveError(false),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey })
    },
    onError: () => setSaveError(true),
  })

  const reset = useTanMutation({
    mutationFn: () => oaClient.resetBusinessProfileDraft({ officialAccountId: oaId }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  })

  const publish = useTanMutation({
    mutationFn: () =>
      oaClient.publishBusinessProfile({
        officialAccountId: oaId,
        expectedRevision: editor.data?.draft?.serverRevision,
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  })

  const saveTextField = useCallback(
    (key: 'displayName' | 'uniqueId' | 'statusMessage' | 'phoneNumber', value: string) => {
      autosave.mutate({ [key]: value } as BusinessProfilePatch)
    },
    [autosave],
  )

  const saveJsonField = useCallback(
    (
      key:
        | 'buttons'
        | 'address'
        | 'paymentMethods'
        | 'businessHours'
        | 'websites'
        | 'visibilitySettings'
        | 'announcements'
        | 'mixedMediaFeed'
        | 'socialMedia'
        | 'basicInfoBlock',
      value: unknown,
    ) => {
      autosave.mutate({ [key]: makeProfileJson(value) } as BusinessProfilePatch)
    },
    [autosave],
  )

  return {
    editor,
    autosave,
    reset,
    publish,
    saveError,
    saveTextField,
    saveJsonField,
  }
}
```

- [ ] **Step 6: Add account-page layout and header**

Create `apps/web/app/(app)/manager/[oaId]/account-page/_layout.tsx`:

```tsx
import { Slot } from 'one'
import { YStack } from 'tamagui'

export default function ManagerAccountPageLayout() {
  return (
    <YStack
      flex={1}
      bg="$background"
      $platform-web={{ height: '100vh', minHeight: '100vh' }}
    >
      <Slot />
    </YStack>
  )
}
```

Create `apps/web/src/features/oa-manager/shared/ManagerOAAccountSwitcher.tsx` by
extracting the account name/unique ID display and OA switching affordance from
the manager home header into a small reusable component. The component should
own only the switcher UI; each route layout still owns its complete header.

Create `apps/web/src/features/oa-manager/profile/AccountPageHeader.tsx`:

```tsx
import { SizableText, XStack } from 'tamagui'
import { ManagerOAAccountSwitcher } from '~/features/oa-manager/shared/ManagerOAAccountSwitcher'
import { Button } from '~/interface/buttons/Button'
import type { OfficialAccount } from '@vine/proto/oa'

type Props = {
  account: OfficialAccount | undefined
  onBack: () => void
}

export function AccountPageHeader({ account, onBack }: Props) {
  return (
    <XStack
      height="$6"
      px="$5"
      shrink={0}
      items="center"
      bg="$background"
      borderBottomWidth={1}
      borderColor="$borderColor"
      gap="$3"
    >
      <SizableText size="$4" fontWeight="700" color="$color12">
        Vine Official Account Manager
      </SizableText>
      {account ? (
        <ManagerOAAccountSwitcher account={account} />
      ) : null}
      <XStack flex={1} />
      <Button size="$2" variant="outlined" onPress={onBack}>
        Home
      </Button>
    </XStack>
  )
}
```

- [ ] **Step 7: Add editor shell components**

Implementation constraints for the editor components:

- Use `react-hook-form`, `Controller`, and valibot schemas for editable profile fields.
- Use shared `~/interface/forms/*` controls where available. Do not import raw Tamagui `Input` or `Switch` for real form fields.
- Keep a local form draft so the preview updates immediately while autosave is debounced.
- Autosave on debounced field changes and on blur; do not wait for blur-only updates.
- The component snippets below describe layout and data flow. Adapt the field controls to the form stack above during implementation.

Create `apps/web/src/features/oa-manager/profile/BusinessProfilePreview.tsx`:

```tsx
import { SizableText, XStack, YStack } from 'tamagui'
import { Button } from '~/interface/buttons/Button'
import type { BusinessProfile } from '@vine/proto/oa'
import type { EditorSection } from './clientTypes'

type Props = {
  draft: BusinessProfile | undefined
  selected: EditorSection
  onSelect: (section: EditorSection) => void
}

const blocks: Array<{ key: EditorSection; label: string }> = [
  { key: 'businessProfile', label: 'Business profile' },
  { key: 'announcements', label: 'Announcements' },
  { key: 'mixedMediaFeed', label: 'Mixed media feed' },
  { key: 'socialMedia', label: 'Social media' },
  { key: 'basicInfo', label: 'Basic info' },
]

export function BusinessProfilePreview({ draft, selected, onSelect }: Props) {
  return (
    <YStack width={420} shrink={0} bg="$color2" borderRightWidth={1} borderColor="$borderColor">
      <XStack p="$3" justify="flex-end">
        <Button size="$2" variant="outlined">
          Preview
        </Button>
      </XStack>
      <YStack px="$6" gap="$4" $platform-web={{ overflowY: 'auto' }}>
        {blocks.map((block) => (
          <YStack
            key={block.key}
            p="$3"
            bg="$background"
            borderWidth={1}
            borderStyle={selected === block.key ? 'dashed' : 'solid'}
            borderColor={selected === block.key ? '$blue8' : '$borderColor'}
            rounded="$2"
            gap="$2"
            cursor="pointer"
            onPress={() => onSelect(block.key)}
          >
            <XStack items="center" justify="space-between">
              <SizableText size="$3" fontWeight="700">
                {block.key === 'businessProfile' ? draft?.displayName || 'Account' : block.label}
              </SizableText>
              {selected === block.key ? (
                <SizableText size="$1" color="$blue10">
                  Edit
                </SizableText>
              ) : null}
            </XStack>
            <SizableText size="$2" color="$color10">
              {block.key === 'businessProfile'
                ? draft?.statusMessage || 'No status message'
                : 'Configure this profile block.'}
            </SizableText>
          </YStack>
        ))}
      </YStack>
      <YStack mt="auto" p="$4" borderTopWidth={1} borderColor="$borderColor">
        <SizableText size="$3" fontWeight="700" color="$green10" text="center">
          + Add plug-in
        </SizableText>
      </YStack>
    </YStack>
  )
}
```

Create `apps/web/src/features/oa-manager/profile/BusinessProfileForm.tsx`:

```tsx
import { Label, SizableText, XStack, YStack } from 'tamagui'
import { Button } from '~/interface/buttons/Button'
import { Input } from '~/interface/forms/Input'
import { Switch } from '~/interface/forms/Switch'
import type { BusinessProfile, BusinessProfilePatch } from '@vine/proto/oa'

type Props = {
  draft: BusinessProfile | undefined
  onSave: (patch: BusinessProfilePatch) => void
}

export function BusinessProfileForm({ draft, onSave }: Props) {
  if (!draft) return null

  return (
    <YStack gap="$5" maxW={820}>
      <SizableText size="$7" fontWeight="700">
        Edit business profile
      </SizableText>
      <YStack gap="$3">
        <Label>Account name</Label>
        <Input
          defaultValue={draft.displayName}
          onBlur={(event) => onSave({ displayName: event.currentTarget.value })}
        />
      </YStack>
      <YStack gap="$3">
        <Label>Unique ID</Label>
        <Input
          defaultValue={draft.uniqueId}
          onBlur={(event) => onSave({ uniqueId: event.currentTarget.value })}
        />
      </YStack>
      <YStack gap="$3">
        <Label>Status message</Label>
        <Input
          defaultValue={draft.statusMessage}
          onBlur={(event) => onSave({ statusMessage: event.currentTarget.value })}
        />
      </YStack>
      <XStack items="center" justify="space-between">
        <YStack>
          <SizableText fontWeight="700">Show number of followers</SizableText>
          <SizableText size="$2" color="$color10">
            Show follower count on the profile page.
          </SizableText>
        </YStack>
        <Switch
          checked={draft.showFollowerCount}
          onCheckedChange={(value) => onSave({ showFollowerCount: value })}
        />
      </XStack>
      <YStack gap="$3">
        <SizableText size="$5" fontWeight="700">
          Design
        </SizableText>
        <Button onPress={() => onSave({ footerButtonColor: '#06c755' })}>
          Use Vine green footer button
        </Button>
      </YStack>
    </YStack>
  )
}
```

Create `apps/web/src/features/oa-manager/profile/ProfileBlockEditors.tsx`:

```tsx
import { Label, SizableText, XStack, YStack } from 'tamagui'
import { Input } from '~/interface/forms/Input'
import { Switch } from '~/interface/forms/Switch'
import { makeProfileJson, parseProfileJson } from './clientTypes'
import type { BusinessProfile, BusinessProfilePatch } from '@vine/proto/oa'
import type { EditorSection } from './clientTypes'

type Props = {
  section: Exclude<EditorSection, 'businessProfile'>
  draft: BusinessProfile | undefined
  onSave: (patch: BusinessProfilePatch) => void
}

export function ProfileBlockEditors({ section, draft, onSave }: Props) {
  if (!draft) return null
  const labels = {
    announcements: 'Announcements',
    mixedMediaFeed: 'Mixed media feed',
    socialMedia: 'Social media',
    basicInfo: 'Basic info',
  }
  const fieldName =
    section === 'basicInfo' ? 'basicInfoBlock' : section
  const value = parseProfileJson<Record<string, any>>((draft as any)[fieldName], {})

  return (
    <YStack gap="$4" maxW={760}>
      <SizableText size="$7" fontWeight="700">
        {labels[section]}
      </SizableText>
      <XStack items="center" justify="space-between">
        <SizableText fontWeight="700">Enabled</SizableText>
        <Switch
          checked={Boolean(value.enabled)}
          onCheckedChange={(enabled) =>
            onSave({ [fieldName]: makeProfileJson({ ...value, enabled }) } as any)
          }
        />
      </XStack>
      <YStack gap="$2">
        <Label>Title</Label>
        <Input
          defaultValue={value.title ?? ''}
          onBlur={(event) =>
            onSave({
              [fieldName]: makeProfileJson({
                ...value,
                title: event.currentTarget.value,
              }),
            } as any)
          }
        />
      </YStack>
    </YStack>
  )
}
```

Create `apps/web/src/features/oa-manager/profile/BusinessProfileEditor.tsx`:

```tsx
import { useRouter } from 'one'
import { useState } from 'react'
import { Spinner, SizableText, XStack, YStack } from 'tamagui'
import { Button } from '~/interface/buttons/Button'
import { getBusinessProfileSaveStatus } from './saveStatus'
import { AccountPageHeader } from './AccountPageHeader'
import { BusinessProfileForm } from './BusinessProfileForm'
import { BusinessProfilePreview } from './BusinessProfilePreview'
import { ProfileBlockEditors } from './ProfileBlockEditors'
import { useBusinessProfileEditor } from './useBusinessProfileEditor'
import type { EditorSection } from './clientTypes'

type Props = { oaId: string }

export function BusinessProfileEditor({ oaId }: Props) {
  const router = useRouter()
  const [selected, setSelected] = useState<EditorSection>('businessProfile')
  const editor = useBusinessProfileEditor(oaId)
  const data = editor.editor.data

  if (editor.editor.isLoading || !data?.draft) {
    return (
      <YStack items="center" justify="center" flex={1}>
        <Spinner size="large" />
      </YStack>
    )
  }

  const status = getBusinessProfileSaveStatus({
    isSaving: editor.autosave.isPending,
    isError: editor.saveError,
    isDirty: data.isDirty,
  })

  return (
    <YStack flex={1} minH={0}>
      <AccountPageHeader
        account={data.account}
        onBack={() => router.navigate(`/manager/${oaId}` as any)}
      />
      <XStack height="$6" px="$5" items="center" borderBottomWidth={1} borderColor="$borderColor">
        <SizableText size="$4" fontWeight="700">
          Business profile settings
        </SizableText>
        <XStack flex={1} />
        <SizableText size="$2" color={status.tone === 'danger' ? '$red10' : '$green10'}>
          {status.label}
        </SizableText>
        <Button
          ml="$3"
          disabled={!data.isDirty || editor.autosave.isPending || editor.saveError}
          onPress={() => editor.publish.mutate()}
        >
          Publish
        </Button>
      </XStack>
      <XStack flex={1} minH={0}>
        <BusinessProfilePreview
          draft={data.draft}
          selected={selected}
          onSelect={setSelected}
        />
        <YStack flex={1} p="$6" $platform-web={{ overflowY: 'auto' }}>
          {selected === 'businessProfile' ? (
            <BusinessProfileForm draft={data.draft} onSave={(patch) => editor.autosave.mutate(patch)} />
          ) : (
            <ProfileBlockEditors
              section={selected}
              draft={data.draft}
              onSave={(patch) => editor.autosave.mutate(patch)}
            />
          )}
        </YStack>
      </XStack>
    </YStack>
  )
}
```

- [ ] **Step 8: Add route**

Create `apps/web/app/(app)/manager/[oaId]/account-page/profile.tsx`:

```tsx
import { createRoute } from 'one'
import { BusinessProfileEditor } from '~/features/oa-manager/profile/BusinessProfileEditor'

const route = createRoute<'/(app)/manager/[oaId]/account-page/profile'>()

export default function ManagerAccountPageProfileRoute() {
  const { oaId } = route.useParams()
  return <BusinessProfileEditor oaId={oaId} />
}
```

- [ ] **Step 9: Run unit tests**

Run:

```bash
rtk bun run --cwd apps/web test:unit -- saveStatus.test.ts
```

Expected: PASS.

- [ ] **Step 10: Commit**

```bash
rtk git add apps/web/app/'(app)'/manager/'[oaId]'/account-page apps/web/src/features/oa-manager/profile apps/web/src/features/oa-manager/shared/ManagerOAAccountSwitcher.tsx apps/web/src/test/unit/features/oa-manager/saveStatus.test.ts
rtk git commit -m "feat(oa-manager): add business profile editor shell"
```

## Task 5: Image Upload And Complete Business Profile Fields

**Files:**
- Modify: `apps/web/src/features/oa-manager/profile/BusinessProfileForm.tsx`
- Modify: `apps/web/src/features/oa-manager/profile/useBusinessProfileEditor.ts`

- [ ] **Step 1: Add image upload methods to editor hook**

Modify `apps/web/src/features/oa-manager/profile/useBusinessProfileEditor.ts`:

```ts
import { BusinessProfileImageKind } from '@vine/proto/oa'
```

Add mutations before `return`:

```ts
  const uploadImage = useTanMutation({
    mutationFn: (input: { kind: BusinessProfileImageKind; image: Uint8Array; contentType: string }) =>
      oaClient.uploadBusinessProfileImage({
        officialAccountId: oaId,
        kind: input.kind,
        image: input.image,
        contentType: input.contentType,
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
    onError: () => setSaveError(true),
  })

  const removeImage = useTanMutation({
    mutationFn: (kind: BusinessProfileImageKind) =>
      oaClient.removeBusinessProfileImage({ officialAccountId: oaId, kind }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
    onError: () => setSaveError(true),
  })
```

Expose them in the returned object:

```ts
    uploadImage,
    removeImage,
```

- [ ] **Step 2: Add image controls and full fields to form**

Modify `apps/web/src/features/oa-manager/profile/BusinessProfileForm.tsx` to accept image callbacks:

```tsx
import { BusinessProfileImageKind } from '@vine/proto/oa'
import { Image } from 'react-native'
```

Change `Props`:

```ts
type Props = {
  draft: BusinessProfile | undefined
  onSave: (patch: BusinessProfilePatch) => void
  onUploadImage: (input: {
    kind: BusinessProfileImageKind
    image: Uint8Array
    contentType: string
  }) => void
  onRemoveImage: (kind: BusinessProfileImageKind) => void
}
```

Add image controls below the heading:

```tsx
      <XStack gap="$4" items="center">
        <YStack gap="$2">
          <SizableText fontWeight="700">Profile photo</SizableText>
          {draft.profileImageUrl ? (
            <Image
              source={{ uri: draft.profileImageUrl }}
              style={{ width: 72, height: 72, borderRadius: 36 }}
            />
          ) : null}
          <Button
            variant="outlined"
            onPress={() => onRemoveImage(BusinessProfileImageKind.PROFILE)}
          >
            Remove profile photo
          </Button>
        </YStack>
        <YStack gap="$2">
          <SizableText fontWeight="700">Cover photo</SizableText>
          {draft.coverImageUrl ? (
            <Image
              source={{ uri: draft.coverImageUrl }}
              style={{ width: 220, height: 96 }}
            />
          ) : null}
          <Button
            variant="outlined"
            onPress={() => onRemoveImage(BusinessProfileImageKind.COVER)}
          >
            Remove cover photo
          </Button>
        </YStack>
      </XStack>
```

Add remaining field placeholders that save structured data:

```tsx
      <YStack gap="$3">
        <Label>Phone number</Label>
        <Input
          defaultValue={draft.phoneNumber}
          onBlur={(event) => onSave({ phoneNumber: event.currentTarget.value })}
        />
      </YStack>
      <YStack gap="$3">
        <Label>Footer button splash labels</Label>
        <Input
          defaultValue={draft.splashLabels.join(', ')}
          onBlur={(event) =>
            onSave({
              splashLabels: {
                values: event.currentTarget.value
                  .split(',')
                  .map((label) => label.trim())
                  .filter(Boolean)
                  .slice(0, 3),
              },
            })
          }
        />
      </YStack>
```

- [ ] **Step 3: Wire image callbacks from shell**

Modify `BusinessProfileEditor.tsx` `BusinessProfileForm` usage:

```tsx
            <BusinessProfileForm
              draft={data.draft}
              onSave={(patch) => editor.autosave.mutate(patch)}
              onUploadImage={(input) => editor.uploadImage.mutate(input)}
              onRemoveImage={(kind) => editor.removeImage.mutate(kind)}
            />
```

- [ ] **Step 4: Run typecheck**

Run:

```bash
rtk bun run --cwd apps/web typecheck
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
rtk git add apps/web/src/features/oa-manager/profile
rtk git commit -m "feat(oa-manager): wire business profile image controls"
```

## Task 6: Public Profile Reads Published Business Profile

**Files:**
- Modify: `apps/server/src/services/oa.ts`
- Modify: `apps/server/src/connect/oa.ts`
- Modify: `packages/proto/proto/oa/v1/oa.proto`
- Regenerate: `packages/proto/gen/oa/v1/oa_pb.ts`
- Modify: `apps/web/src/interface/oa/OADetailContent.tsx`
- Modify: `apps/web/src/test/integration/oa-detail.test.ts`

- [ ] **Step 1: Add public profile fields to summary proto**

Modify `OfficialAccountSummary` in `packages/proto/proto/oa/v1/oa.proto`:

Preserve existing field numbers 1-5 exactly. Only append new fields starting at
6; do not renumber or reuse existing tags.

```proto
message OfficialAccountSummary {
  string id = 1;
  string name = 2;
  string unique_id = 3;
  string description = 4;
  string image_url = 5;
  string cover_image_url = 6;
  string status_message = 7;
  bool show_follower_count = 8;
  repeated string splash_labels = 9;
  string footer_button_color = 10;
  BusinessProfileJson buttons = 11;
  BusinessProfileJson social_media = 12;
  BusinessProfileJson basic_info_block = 13;
}
```

Run:

```bash
rtk bun run --cwd packages/proto proto:generate
```

Expected: generated summary type includes new fields.

- [ ] **Step 2: Add service helpers for published profile**

Add to `apps/server/src/services/oa.ts`:

```ts
  async function getPublishedBusinessProfile(oaId: string) {
    const [profile] = await db
      .select()
      .from(oaBusinessProfile)
      .where(eq(oaBusinessProfile.oaId, oaId))
      .limit(1)
    return profile ?? null
  }
```

Return it from `createOAService`.

- Add `getPublishedBusinessProfiles(oaIds: string[])` that returns a `Map` keyed
  by OA ID. Use this batch helper for search and recommendation results so the
  public profile mapping does not do one query per account.

- [ ] **Step 3: Use published profile in resolve/search mapping**

Modify `apps/server/src/connect/oa.ts` `resolveOfficialAccount` to load the profile:

```ts
        const profile = await deps.oa.getPublishedBusinessProfile(account.id)
        return {
          account: {
            id: account.id,
            name: profile?.displayName ?? account.name,
            uniqueId: profile?.uniqueId ?? account.uniqueId,
            description: profile?.statusMessage ?? account.description ?? '',
            imageUrl: profile?.profileImageUrl ?? account.imageUrl ?? '',
            coverImageUrl: profile?.coverImageUrl ?? '',
            statusMessage: profile?.statusMessage ?? account.description ?? '',
            showFollowerCount: profile?.showFollowerCount ?? false,
            splashLabels: profile?.splashLabels ?? [],
            footerButtonColor: profile?.footerButtonColor ?? '#06c755',
            buttons: jsonField(profile?.buttons ?? []),
            socialMedia: jsonField(profile?.socialMedia ?? {}),
            basicInfoBlock: jsonField(profile?.basicInfoBlock ?? {}),
          },
        }
```

Apply the same mapping to both `searchOfficialAccounts` and
`recommendOfficialAccounts` by fetching all needed published profiles with
`getPublishedBusinessProfiles(accountIds)` before mapping the response. Keep
legacy fallback values for accounts without a published business profile row.

- [ ] **Step 4: Remove mock constants from OADetailContent**

Modify `apps/web/src/interface/oa/OADetailContent.tsx`:

- Delete `MOCK_COVER_URL`, `MOCK_FRIEND_COUNT`, `MOCK_POST_COUNT`, `MOCK_LOCATION`, and `MOCK_DESCRIPTION`.
- Extend `OADetailContentData`:

```ts
export type OADetailContentData = {
  id: string
  name: string
  oaId: string
  imageUrl?: string
  coverImageUrl?: string
  description?: string
}
```

- Replace cover image source:

```tsx
{coverImageUrl ? (
  <Image src={coverImageUrl} alt="Cover" width="100%" height={180} objectFit="cover" />
) : (
  <YStack height={180} bg="$color5" />
)}
```

- Replace friend count text with the account ID label until this component is
  passed a real follower count:

```tsx
<Text fontSize={12} color="$color10" mt="$1" mb="$3">
  @{oaId}
</Text>
```

- Replace description:

```tsx
{description ? (
  <YStack p="$3" bg="$color2" rounded="$4" borderWidth={1} borderColor="$borderColor" mb="$4">
    <Text fontSize={14} color="$color11" lineHeight={20}>
      {description}
    </Text>
  </YStack>
) : null}
```

- Replace post count label with static "貼文" or hide the post card until a real post count exists.

- [ ] **Step 5: Update callers of OADetailContent**

Run:

```bash
rtk rg -n "OADetailContent" apps/web/src apps/web/app
```

For each caller, pass `coverImageUrl` and `description` when available from `OfficialAccountSummary`. Keep existing behavior when fields are absent.

- [ ] **Step 6: Run public profile integration test**

Run:

```bash
rtk bun scripts/integration.ts --web-only oa-detail.test.ts
```

Expected: PASS when local dev stack is running. If no stack is running, record the skip reason and rely on unit/type checks.

- [ ] **Step 7: Commit**

```bash
rtk git add packages/proto/proto/oa/v1/oa.proto packages/proto/gen/oa/v1/oa_pb.ts apps/server/src/services/oa.ts apps/server/src/connect/oa.ts apps/web/src/interface/oa/OADetailContent.tsx apps/web/src/test/integration/oa-detail.test.ts
rtk git commit -m "feat(oa-manager): publish profile to public oa sheet"
```

## Task 7: Manager Home Link And Integration Coverage

**Files:**
- Modify: `apps/web/app/(app)/manager/[oaId]/(home)/_layout.tsx`
- Modify: `apps/web/src/features/oa-manager/home/ManagerOAHome.tsx`
- Add: `apps/web/src/test/integration/manager-oa-profile.test.ts`

- [ ] **Step 1: Reuse account switcher in the home header**

Modify `apps/web/app/(app)/manager/[oaId]/(home)/_layout.tsx` to replace the
inline account name/unique ID display with `ManagerOAAccountSwitcher`. Keep the
home header itself in this home layout; do not move it to a shared `_layout`.

- [ ] **Step 2: Update home edit action**

Modify `apps/web/src/features/oa-manager/home/ManagerOAHome.tsx`:

```tsx
        <Button
          variant="outlined"
          onPress={() => router.navigate(`/manager/${oaId}/account-page/profile` as any)}
        >
          Edit profile
        </Button>
```

- [ ] **Step 3: Add integration test**

Create `apps/web/src/test/integration/manager-oa-profile.test.ts`:

```ts
import { expect, test } from '@playwright/test'
import { BASE_URL, loginAsDemo } from './helpers'

test.describe('Manager OA business profile editor', () => {
  test('owner opens profile editor from manager home', async ({ page }) => {
    test.setTimeout(60000)

    await loginAsDemo(page)
    await page.goto(`${BASE_URL}/manager`, { waitUntil: 'domcontentloaded' })

    const testBotRow = page.getByText('@testbot').locator('xpath=../..')
    await testBotRow.getByRole('button', { name: 'Manage' }).click()
    await page.waitForURL(/\/manager\/[^/]+$/, { timeout: 15000 })

    await page.getByRole('button', { name: 'Edit profile' }).click()
    await page.waitForURL(/\/manager\/[^/]+\/account-page\/profile$/, {
      timeout: 15000,
    })

    await expect(page.getByText('Business profile settings')).toBeVisible()
    await expect(page.getByText('Edit business profile')).toBeVisible()
    await expect(page.getByText('Add plug-in')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Publish' })).toBeVisible()
  })
})
```

- [ ] **Step 4: Run integration test**

Run:

```bash
rtk bun scripts/integration.ts --web-only manager-oa-profile.test.ts
```

Expected: PASS when the local dev stack is running.

- [ ] **Step 5: Commit**

```bash
rtk git add apps/web/app/'(app)'/manager/'[oaId]'/'(home)'/_layout.tsx apps/web/src/features/oa-manager/home/ManagerOAHome.tsx apps/web/src/features/oa-manager/shared/ManagerOAAccountSwitcher.tsx apps/web/src/test/integration/manager-oa-profile.test.ts
rtk git commit -m "feat(oa-manager): link profile editor from home"
```

## Task 8: Verification And Cleanup

**Files:**
- Review all changed files.

- [ ] **Step 1: Run generated/type checks**

Run:

```bash
rtk bun run --cwd packages/db typecheck
rtk bun run --cwd packages/proto build
rtk bun run --cwd apps/server typecheck
rtk bun run --cwd apps/web typecheck
```

Expected: all PASS.

- [ ] **Step 2: Run focused unit tests**

Run:

```bash
rtk bun run --cwd apps/server test:unit -- oa-business-profile.test.ts
rtk bun run --cwd apps/web test:unit -- saveStatus.test.ts
```

Expected: both PASS.

- [ ] **Step 3: Run focused integration tests**

Run:

```bash
rtk bun scripts/integration.ts --db-only oa-business-profile.int.test.ts
rtk bun scripts/integration.ts --web-only manager-oa-profile.test.ts oa-detail.test.ts manager-oa-home.test.ts
```

Expected: server integration PASS against a test DB; web integration PASS when the local dev stack is running.

- [ ] **Step 4: Run formatting and lint**

Run:

```bash
rtk bun run format
rtk bun run check:all
```

Expected: PASS.

- [ ] **Step 5: Inspect final diff**

Run:

```bash
rtk git status --short
rtk git diff --stat HEAD
```

Expected: only intended Phase 1 implementation files are changed.

- [ ] **Step 6: Final commit**

If Tasks 1-7 were committed individually, this step should have no staged files. If verification changed formatting output, commit it:

```bash
rtk git add .
rtk git commit -m "chore(oa-manager): format profile settings implementation"
```

Expected: commit is created only if formatting produced changes.

## Notes For Implementers

- Use `connect`, `one`, `tamagui`, `vine-data-fetching`, `vine-testing`, and `zero-schema-migration` project skills when executing the implementation tasks that touch those areas.
- Keep `.gitignore`, screenshots, and `oa-profile.html` unrelated changes out of implementation commits unless the user explicitly asks to include them.
- Do not put account-page header ownership into `/manager/:oaId/_layout.tsx`; reuse only smaller components.
- Do not expose draft writes through Zero mutations.
- Do not show draft profile data to users outside the manager editor.
