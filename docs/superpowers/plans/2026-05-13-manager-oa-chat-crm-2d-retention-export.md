# Manager OA Chat CRM Phase 2D Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Vine's Phase 2D owner-only OA contact CRM CSV export while keeping chat history/media backup unavailable.

**Architecture:** Keep CRM state in the existing DB/Zero tables. Add a focused server-side export service that reads OA friendships, users, notes, tags, and chat metadata, then formats a UTF-8 CSV. Expose it through a Better Auth-protected Fastify download endpoint because this is a file download, not normal app data fetching.

**Tech Stack:** Bun, Fastify, Better Auth, Drizzle, Vitest, One, Tamagui, Playwright.

---

## File Structure

- Create `apps/server/src/services/oa-contact-export.ts`
  - Owns CSV column definitions, CSV escaping, contact export row shaping, and DB reads.
  - Returns `null` when the authenticated user does not own the OA.
- Create `apps/server/src/services/oa-contact-export.test.ts`
  - Unit coverage for CSV columns, tag flattening, note escaping, and message-body exclusion.
- Create `apps/server/src/plugins/oa-contact-export.ts`
  - Owns `GET /api/manager/oa/:oaId/contacts/export.csv`.
  - Resolves Better Auth from the incoming request and streams the CSV response.
- Create `apps/server/src/plugins/oa-contact-export.test.ts`
  - Unit coverage for unauthenticated, non-owner/not-found, and successful download behavior.
- Modify `apps/server/src/index.ts`
  - Wire `createOAContactExportService({ db })`.
  - Register `oaContactExportPlugin(app, { auth, contactExport })`.
- Modify `apps/web/src/features/oa-manager/chat/ManagerOAContactList.tsx`
  - Add the owner-facing `Export contacts CSV` action in contact list mode.
  - Keep chat history export absent, with short unavailable copy.
- Modify `apps/web/src/test/integration/manager-oa-chat.test.ts`
  - Assert the contact CSV export action is visible in contact mode.
  - Assert chat history export is not exposed as an actionable control.

Do not add Zero schema, migrations, ConnectRPC proto, or raw chat message export for this phase.

## Task 1: Server Export Service

**Files:**
- Create: `apps/server/src/services/oa-contact-export.ts`
- Create: `apps/server/src/services/oa-contact-export.test.ts`

- [ ] **Step 1: Write the failing CSV unit tests**

Create `apps/server/src/services/oa-contact-export.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import {
  buildOAContactExportCsv,
  OA_CONTACT_EXPORT_COLUMNS,
  type OAContactExportRow,
} from './oa-contact-export'

const exportedAt = new Date('2026-05-13T08:09:10.000Z')

function makeRow(overrides: Partial<OAContactExportRow> = {}): OAContactExportRow {
  return {
    providerScopedUserId: 'user-1',
    displayName: 'Test One',
    friendshipStatus: 'friend',
    lastInteractionAt: '2026-05-12T01:02:03.000Z',
    chatStatus: 'active',
    tagIds: ['tag-2', 'tag-1'],
    tagNames: ['Repeat buyer', 'VIP'],
    managerNoteText: 'Follow up, "quoted"\nnext line',
    exportedAt: exportedAt.toISOString(),
    ...overrides,
  }
}

describe('OA contact CRM CSV export', () => {
  it('uses the approved Phase 2D columns', () => {
    expect(OA_CONTACT_EXPORT_COLUMNS).toEqual([
      'provider_scoped_user_id',
      'display_name',
      'friendship_status',
      'last_interaction_at',
      'chat_status',
      'tag_ids',
      'tag_names',
      'manager_note_text',
      'exported_at',
    ])
  })

  it('escapes notes and flattens tag IDs and names into semicolon-separated cells', () => {
    const csv = buildOAContactExportCsv([makeRow()])

    expect(csv).toContain(
      [
        'provider_scoped_user_id',
        'display_name',
        'friendship_status',
        'last_interaction_at',
        'chat_status',
        'tag_ids',
        'tag_names',
        'manager_note_text',
        'exported_at',
      ].join(','),
    )
    expect(csv).toContain(
      'user-1,Test One,friend,2026-05-12T01:02:03.000Z,active,tag-2;tag-1,Repeat buyer;VIP,"Follow up, ""quoted""\nnext line",2026-05-13T08:09:10.000Z',
    )
  })

  it('keeps empty optional values as empty CSV cells', () => {
    const csv = buildOAContactExportCsv([
      makeRow({
        displayName: '',
        lastInteractionAt: '',
        chatStatus: 'no_chat',
        tagIds: [],
        tagNames: [],
        managerNoteText: '',
      }),
    ])

    expect(csv).toContain('user-1,,friend,,no_chat,,,,2026-05-13T08:09:10.000Z')
  })

  it('does not include chat message bodies', () => {
    const csv = buildOAContactExportCsv([
      makeRow({ managerNoteText: 'Manager-only CRM note' }),
    ])

    expect(csv).toContain('Manager-only CRM note')
    expect(csv).not.toContain('message_body')
    expect(csv).not.toContain('hello from chat')
  })
})
```

- [ ] **Step 2: Run the service unit test and verify it fails**

Run:

```bash
rtk bun run --cwd apps/server test:unit -- oa-contact-export.test.ts
```

Expected: FAIL because `apps/server/src/services/oa-contact-export.ts` does not exist yet.

- [ ] **Step 3: Add the export service implementation**

Create `apps/server/src/services/oa-contact-export.ts`:

```ts
import {
  oaContactProfile,
  oaContactTag,
  oaContactTagAssignment,
  oaFriendship,
  oaProvider,
  officialAccount,
} from '@vine/db/schema-oa'
import { chat, chatMember, userPublic } from '@vine/db/schema-public'
import { and, eq, inArray, isNotNull } from 'drizzle-orm'
import { alias } from 'drizzle-orm/pg-core'
import type { schema } from '@vine/db'
import type { NodePgDatabase } from 'drizzle-orm/node-postgres'

export const OA_CONTACT_EXPORT_COLUMNS = [
  'provider_scoped_user_id',
  'display_name',
  'friendship_status',
  'last_interaction_at',
  'chat_status',
  'tag_ids',
  'tag_names',
  'manager_note_text',
  'exported_at',
] as const

export type OAContactExportRow = {
  providerScopedUserId: string
  displayName: string
  friendshipStatus: string
  lastInteractionAt: string
  chatStatus: 'active' | 'no_chat'
  tagIds: string[]
  tagNames: string[]
  managerNoteText: string
  exportedAt: string
}

type OAContactExportDeps = {
  db: NodePgDatabase<typeof schema>
}

type ExportContactsInput = {
  oaId: string
  ownerId: string
  exportedAt: Date
}

type ExportContactsResult = {
  filename: string
  csv: string
}

function csvCell(value: string): string {
  if (!/[",\n\r]/.test(value)) return value
  return `"${value.replaceAll('"', '""')}"`
}

function rowToCsv(row: OAContactExportRow): string {
  return [
    row.providerScopedUserId,
    row.displayName,
    row.friendshipStatus,
    row.lastInteractionAt,
    row.chatStatus,
    row.tagIds.join(';'),
    row.tagNames.join(';'),
    row.managerNoteText,
    row.exportedAt,
  ]
    .map(csvCell)
    .join(',')
}

export function buildOAContactExportCsv(rows: OAContactExportRow[]): string {
  return [OA_CONTACT_EXPORT_COLUMNS.join(','), ...rows.map(rowToCsv)].join('\n')
}

function filenameFor(uniqueId: string, exportedAt: Date): string {
  const safeUniqueId = uniqueId.replace(/[^a-zA-Z0-9_-]/g, '_')
  const date = exportedAt.toISOString().slice(0, 10)
  return `oa-${safeUniqueId}-contacts-${date}.csv`
}

export function createOAContactExportService(deps: OAContactExportDeps) {
  const { db } = deps

  async function exportContactsCsv(
    input: ExportContactsInput,
  ): Promise<ExportContactsResult | null> {
    const [account] = await db
      .select({
        id: officialAccount.id,
        uniqueId: officialAccount.uniqueId,
      })
      .from(officialAccount)
      .innerJoin(oaProvider, eq(officialAccount.providerId, oaProvider.id))
      .where(and(eq(officialAccount.id, input.oaId), eq(oaProvider.ownerId, input.ownerId)))
      .limit(1)

    if (!account) return null

    const contacts = await db
      .select({
        userId: oaFriendship.userId,
        friendshipStatus: oaFriendship.status,
        displayName: userPublic.name,
        noteText: oaContactProfile.noteText,
      })
      .from(oaFriendship)
      .leftJoin(userPublic, eq(oaFriendship.userId, userPublic.id))
      .leftJoin(
        oaContactProfile,
        and(
          eq(oaContactProfile.oaId, oaFriendship.oaId),
          eq(oaContactProfile.userId, oaFriendship.userId),
        ),
      )
      .where(and(eq(oaFriendship.oaId, input.oaId), eq(oaFriendship.status, 'friend')))

    const userIds = contacts.map((contact) => contact.userId)
    const tagsByUserId = new Map<string, Array<{ id: string; name: string }>>()
    const chatByUserId = new Map<string, { lastInteractionAt: string }>()

    if (userIds.length > 0) {
      const tagRows = await db
        .select({
          userId: oaContactTagAssignment.userId,
          tagId: oaContactTag.id,
          tagName: oaContactTag.name,
        })
        .from(oaContactTagAssignment)
        .innerJoin(oaContactTag, eq(oaContactTagAssignment.tagId, oaContactTag.id))
        .where(
          and(
            eq(oaContactTagAssignment.oaId, input.oaId),
            inArray(oaContactTagAssignment.userId, userIds),
          ),
        )

      for (const tag of tagRows) {
        const userTags = tagsByUserId.get(tag.userId) ?? []
        userTags.push({ id: tag.tagId, name: tag.tagName })
        tagsByUserId.set(tag.userId, userTags)
      }

      const userMember = alias(chatMember, 'userMember')
      const oaMember = alias(chatMember, 'oaMember')

      const chatRows = await db
        .select({
          userId: userMember.userId,
          lastMessageAt: chat.lastMessageAt,
        })
        .from(userMember)
        .innerJoin(
          oaMember,
          and(eq(userMember.chatId, oaMember.chatId), eq(oaMember.oaId, input.oaId)),
        )
        .innerJoin(chat, eq(chat.id, userMember.chatId))
        .where(
          and(
            eq(chat.type, 'oa'),
            isNotNull(userMember.userId),
            inArray(userMember.userId, userIds),
          ),
        )

      for (const chatRow of chatRows) {
        if (!chatRow.userId || !chatRow.lastMessageAt) continue
        const existing = chatByUserId.get(chatRow.userId)
        if (!existing || chatRow.lastMessageAt > existing.lastInteractionAt) {
          chatByUserId.set(chatRow.userId, { lastInteractionAt: chatRow.lastMessageAt })
        }
      }
    }

    const exportedAt = input.exportedAt.toISOString()
    const rows: OAContactExportRow[] = contacts
      .map((contact) => {
        const tags = (tagsByUserId.get(contact.userId) ?? []).sort((a, b) =>
          a.name === b.name ? a.id.localeCompare(b.id) : a.name.localeCompare(b.name),
        )
        const chatInfo = chatByUserId.get(contact.userId)

        return {
          providerScopedUserId: contact.userId,
          displayName: contact.displayName ?? '',
          friendshipStatus: contact.friendshipStatus,
          lastInteractionAt: chatInfo?.lastInteractionAt ?? '',
          chatStatus: chatInfo ? 'active' : 'no_chat',
          tagIds: tags.map((tag) => tag.id),
          tagNames: tags.map((tag) => tag.name),
          managerNoteText: contact.noteText ?? '',
          exportedAt,
        }
      })
      .sort((a, b) =>
        a.displayName === b.displayName
          ? a.providerScopedUserId.localeCompare(b.providerScopedUserId)
          : a.displayName.localeCompare(b.displayName),
      )

    return {
      filename: filenameFor(account.uniqueId, input.exportedAt),
      csv: buildOAContactExportCsv(rows),
    }
  }

  return { exportContactsCsv }
}
```

- [ ] **Step 4: Run the service unit test and verify it passes**

Run:

```bash
rtk bun run --cwd apps/server test:unit -- oa-contact-export.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit Task 1**

Run:

```bash
rtk git add apps/server/src/services/oa-contact-export.ts apps/server/src/services/oa-contact-export.test.ts
rtk git commit -m "feat: add oa contact csv export service"
```

## Task 2: Authenticated CSV Download Route

**Files:**
- Create: `apps/server/src/plugins/oa-contact-export.ts`
- Create: `apps/server/src/plugins/oa-contact-export.test.ts`
- Modify: `apps/server/src/index.ts`

- [ ] **Step 1: Write the failing route tests**

Create `apps/server/src/plugins/oa-contact-export.test.ts`:

```ts
import Fastify from 'fastify'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { oaContactExportPlugin } from './oa-contact-export'

vi.mock('@take-out/better-auth-utils/server', () => ({
  getAuthDataFromRequest: vi.fn(),
}))

import { getAuthDataFromRequest } from '@take-out/better-auth-utils/server'

const mockedAuth = vi.mocked(getAuthDataFromRequest)

function createApp() {
  const contactExport = {
    exportContactsCsv: vi.fn(),
  }
  const auth = {} as any
  const app = Fastify()
  return {
    app,
    auth,
    contactExport,
    register: () => app.register(oaContactExportPlugin, { auth, contactExport }),
  }
}

beforeEach(() => {
  mockedAuth.mockReset()
})

describe('oa-contact-export plugin', () => {
  it('returns 401 when unauthenticated', async () => {
    mockedAuth.mockResolvedValue(null as any)
    const { app, contactExport, register } = createApp()
    await register()

    const res = await app.inject({
      method: 'GET',
      url: '/api/manager/oa/oa-1/contacts/export.csv',
    })

    expect(res.statusCode).toBe(401)
    expect(contactExport.exportContactsCsv).not.toHaveBeenCalled()
  })

  it('returns 404 when the OA is not visible to the authenticated owner', async () => {
    mockedAuth.mockResolvedValue({ id: 'user-2' } as any)
    const { app, contactExport, register } = createApp()
    contactExport.exportContactsCsv.mockResolvedValue(null)
    await register()

    const res = await app.inject({
      method: 'GET',
      url: '/api/manager/oa/oa-1/contacts/export.csv',
    })

    expect(res.statusCode).toBe(404)
    expect(JSON.parse(res.body)).toEqual({ message: 'Official account not found' })
    expect(contactExport.exportContactsCsv).toHaveBeenCalledWith({
      oaId: 'oa-1',
      ownerId: 'user-2',
      exportedAt: expect.any(Date),
    })
  })

  it('returns a CSV attachment for the OA owner', async () => {
    mockedAuth.mockResolvedValue({ id: 'owner-1' } as any)
    const { app, contactExport, register } = createApp()
    contactExport.exportContactsCsv.mockResolvedValue({
      filename: 'oa-test-contacts-2026-05-13.csv',
      csv: 'provider_scoped_user_id\nuser-1',
    })
    await register()

    const res = await app.inject({
      method: 'GET',
      url: '/api/manager/oa/oa-1/contacts/export.csv',
    })

    expect(res.statusCode).toBe(200)
    expect(res.headers['content-type']).toContain('text/csv; charset=utf-8')
    expect(res.headers['content-disposition']).toBe(
      'attachment; filename="oa-test-contacts-2026-05-13.csv"',
    )
    expect(res.body).toBe('provider_scoped_user_id\nuser-1')
  })
})
```

- [ ] **Step 2: Run the route test and verify it fails**

Run:

```bash
rtk bun run --cwd apps/server test:unit -- oa-contact-export.test.ts
```

Expected: FAIL because `apps/server/src/plugins/oa-contact-export.ts` does not exist yet.

- [ ] **Step 3: Add the authenticated Fastify route**

Create `apps/server/src/plugins/oa-contact-export.ts`:

```ts
import { getAuthDataFromRequest } from '@take-out/better-auth-utils/server'
import { logger } from '../lib/logger'
import { toWebRequest } from '../utils'
import type { createAuthServer } from './auth'
import type { createOAContactExportService } from '../services/oa-contact-export'
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'

type OAContactExportPluginDeps = {
  auth: ReturnType<typeof createAuthServer>
  contactExport: ReturnType<typeof createOAContactExportService>
}

type ExportParams = {
  oaId: string
}

export async function oaContactExportPlugin(
  fastify: FastifyInstance,
  deps: OAContactExportPluginDeps,
) {
  fastify.get(
    '/api/manager/oa/:oaId/contacts/export.csv',
    async (
      request: FastifyRequest<{ Params: ExportParams }>,
      reply: FastifyReply,
    ) => {
      const webReq = toWebRequest(request)
      const authData = await getAuthDataFromRequest(deps.auth, webReq).catch(() => null)
      if (!authData?.id) {
        return reply.code(401).send({ message: 'Unauthorized' })
      }

      try {
        const result = await deps.contactExport.exportContactsCsv({
          oaId: request.params.oaId,
          ownerId: authData.id,
          exportedAt: new Date(),
        })

        if (!result) {
          return reply.code(404).send({ message: 'Official account not found' })
        }

        return reply
          .header('Content-Type', 'text/csv; charset=utf-8')
          .header('Content-Disposition', `attachment; filename="${result.filename}"`)
          .send(result.csv)
      } catch (err) {
        logger.error(
          { err, oaId: request.params.oaId },
          '[oa-contact-export] export failed',
        )
        return reply.code(500).send({ message: 'Export failed' })
      }
    },
  )
}
```

- [ ] **Step 4: Wire the service and plugin in the server entrypoint**

Modify `apps/server/src/index.ts`.

Add this import near the other plugins:

```ts
import { oaContactExportPlugin } from './plugins/oa-contact-export'
```

Add this import near the other services:

```ts
import { createOAContactExportService } from './services/oa-contact-export'
```

Create the service after `const oa = createOAService({ db, database })`:

```ts
const oaContactExport = createOAContactExportService({ db })
```

Register the plugin after `await mediaUploadPlugin(app, { auth, drive })`:

```ts
await oaContactExportPlugin(app, { auth, contactExport: oaContactExport })
```

- [ ] **Step 5: Run route tests and server typecheck**

Run:

```bash
rtk bun run --cwd apps/server test:unit -- oa-contact-export.test.ts
rtk bun run --cwd apps/server typecheck
```

Expected: both commands exit 0.

- [ ] **Step 6: Commit Task 2**

Run:

```bash
rtk git add apps/server/src/plugins/oa-contact-export.ts apps/server/src/plugins/oa-contact-export.test.ts apps/server/src/index.ts
rtk git commit -m "feat: expose oa contact csv export"
```

## Task 3: Manager Contact List Export UI

**Files:**
- Modify: `apps/web/src/features/oa-manager/chat/ManagerOAContactList.tsx`
- Modify: `apps/web/src/test/integration/manager-oa-chat.test.ts`

- [ ] **Step 1: Add failing web integration expectations**

Modify `apps/web/src/test/integration/manager-oa-chat.test.ts` inside the existing CRM workflow test, immediately after the first `Show Contacts` click and contact list assertion:

```ts
await page.getByRole('button', { name: 'Show Contacts' }).click()
await expect(page.getByRole('button', { name: 'Export contacts CSV' })).toBeVisible({
  timeout: 10000,
})
await expect(page.getByRole('button', { name: 'Export chat history' })).toHaveCount(0)
```

Keep the existing contact selection assertions below it.

- [ ] **Step 2: Run the targeted integration test and verify it fails**

Run this only when the local Docker dev stack is already running:

```bash
rtk bun run --cwd apps/web test:integration:manual -- manager-oa-chat.test.ts
```

Expected: FAIL because `Export contacts CSV` is not rendered yet.

If the local stack is not running, record that this verification is blocked and continue with unit/type checks. Do not start extra frontend/backend dev servers; Vine local development uses Docker Compose.

- [ ] **Step 3: Add the export action to the contact list**

Modify `apps/web/src/features/oa-manager/chat/ManagerOAContactList.tsx`.

Add imports:

```ts
import { SERVER_URL } from '~/constants/urls'
import { Button } from '~/interface/buttons/Button'
```

Add this helper above `export function ManagerOAContactList`:

```ts
function openContactExport(oaId: string) {
  if (typeof window === 'undefined') return
  const url = `${SERVER_URL}/api/manager/oa/${encodeURIComponent(
    oaId,
  )}/contacts/export.csv`
  window.open(url, '_blank', 'noopener,noreferrer')
}
```

Replace the contact-list header block with this structure:

```tsx
<YStack p="$3" gap="$2" borderBottomWidth={1} borderColor="$borderColor">
  <XStack items="center" justify="space-between" gap="$2">
    <SizableText size="$3" fontWeight="700">
      Contact list
    </SizableText>
    <Button size="$2" onPress={() => openContactExport(oaId)}>
      Export contacts CSV
    </Button>
  </XStack>
  <Input
    value={searchQuery}
    onChangeText={onSearchQueryChange}
    placeholder="Search contacts"
    size="$3"
  />
  <SizableText size="$1" color="$color10">
    Contact CSV only. Chat history backup is unavailable in Phase 2.
  </SizableText>
</YStack>
```

- [ ] **Step 4: Run web typecheck**

Run:

```bash
rtk bun run --cwd apps/web typecheck
```

Expected: exits 0.

- [ ] **Step 5: Run the targeted integration test when the stack is available**

Run:

```bash
rtk bun run --cwd apps/web test:integration:manual -- manager-oa-chat.test.ts
```

Expected: the manager OA chat integration test passes, including the visible `Export contacts CSV` assertion and the absent `Export chat history` button assertion.

- [ ] **Step 6: Commit Task 3**

Run:

```bash
rtk git add apps/web/src/features/oa-manager/chat/ManagerOAContactList.tsx apps/web/src/test/integration/manager-oa-chat.test.ts
rtk git commit -m "feat: add oa contact export action"
```

## Task 4: Final Verification

**Files:**
- No new files.

- [ ] **Step 1: Run server unit tests for the new service and route**

Run:

```bash
rtk bun run --cwd apps/server test:unit -- oa-contact-export.test.ts
```

Expected: exits 0.

- [ ] **Step 2: Run targeted typechecks**

Run:

```bash
rtk bun run --cwd apps/server typecheck
rtk bun run --cwd apps/web typecheck
```

Expected: both commands exit 0.

- [ ] **Step 3: Run formatting/lint verification for touched code**

Run:

```bash
rtk bun run check:all
```

Expected: exits 0.

- [ ] **Step 4: Run the manual integration test if Docker Compose services are healthy**

Check services:

```bash
rtk docker compose ps
```

If the web, server, and zero services are running, run:

```bash
rtk bun run --cwd apps/web test:integration:manual -- manager-oa-chat.test.ts
```

Expected: exits 0.

If services are not running, do not start extra dev servers. Report the integration test as not run because the local Docker Compose stack was unavailable.

- [ ] **Step 5: Confirm no chat export surface was introduced**

Run:

```bash
rtk rg -n "Export chat history|chat history export|message_body|message body export" apps/server/src apps/web/src
```

Expected: only the intentional unavailable copy in `ManagerOAContactList.tsx` may match. There must be no server route or actionable button for chat history export.

- [ ] **Step 6: Commit final verification notes only if code changed during verification**

If verification required code changes, commit them:

```bash
rtk git add apps/server/src apps/web/src
rtk git commit -m "fix: tighten oa contact export verification"
```

If no code changed during verification, skip this commit.

## Self-Review Checklist

- Spec coverage:
  - Owner-only contact CRM CSV export is covered by Tasks 1 and 2.
  - CSV columns are covered by Task 1.
  - Contact-list UI action is covered by Task 3.
  - Chat message body/media export remains unavailable and is checked in Tasks 1, 3, and 4.
  - No LINE paid-plan limits are implemented.
- Scope check:
  - No migrations are needed because Phase 2A-2C already created the CRM tables.
  - No Zero schema changes are needed because export is server-side.
  - No ConnectRPC changes are needed because browser file download is a better fit for raw CSV.
- Test plan:
  - Server unit tests cover CSV formatting, auth, owner-only routing, and response headers.
  - Web integration test covers the visible contact export action and absence of chat history export.
  - Typechecks cover API and UI compile risk.
