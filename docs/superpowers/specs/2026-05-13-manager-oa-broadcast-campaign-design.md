# Manager OA Broadcast Campaign Design

Date: 2026-05-13

## Context

Phase 2 shipped the OA chat CRM foundation: contacts, tags, notes, filters,
retention policy, and contact CRM export. Phase 3 builds on that CRM data to
support outbound communication beyond one-on-one chat.

Vine is a standalone product. LINE Official Account concepts are useful API
references, but Vine should not copy LINE's internal product constraints. The
manager product should use Vine-native audience filters and campaigns. LINE API
compatibility belongs only at the external Messaging API facade.

This spec updates the roadmap direction for Phase 3. Phase 3 is split into:

- Phase 3A: Vine-native audience filters and campaign broadcast MVP.
- Phase 3B: LINE-compatible external Messaging API facade backed by the Phase
  3A model.

## Goals

- Add a reusable audience filter model for selecting OA contacts.
- Represent each outbound bulk send as a campaign record with a durable
  recipient snapshot.
- Support manager-created text campaigns against saved audience filters.
- Support preview counts before send and delivery counts after send.
- Preserve Phase 2 CRM tags as first-class audience query fields.
- Keep campaign send behavior idempotent and recoverable.
- Define a future-safe bridge from LINE-shaped Messaging API requests into
  Vine's native audience and campaign model.

## Non-goals

- No official LINE cloud integration or calls to LINE-hosted services.
- No LINE Business Manager audience sharing.
- No LINE Ads, IFA, web traffic, demographic, or rich-menu audience clone in
  Phase 3A.
- No rich message composer in Phase 3A; text campaigns only.
- No scheduled sending in Phase 3A.
- No automation journeys, drip campaigns, or multi-step marketing flows.
- No external LINE-compatible `/v2/bot/...` facade in Phase 3A.
- No user-side chat behavior changes beyond receiving campaign messages.

## Core Concepts

### Audience Filter

An audience filter is a named, reusable, versioned predicate over Vine's
canonical OA contact fields.

Audience filters are not LINE audience groups internally. They are Vine-native
query definitions that can be created by the manager UI and, later, by external
Messaging API adapters.

Shape:

```ts
type AudienceFilter = {
  id: string
  oaId: string
  name: string
  queryVersion: 1
  query: AudienceQueryJson
  createdByManagerId: string
  createdAt: string
  updatedAt: string
}
```

`AudienceQueryJson` is a controlled Mongo-like predicate document. It should be
data that can be stored, validated, previewed, compiled, and tested. It must not
be arbitrary MongoDB execution.

Example:

```json
{
  "$and": [
    { "friendship.status": "friend" },
    { "tags.ids": { "$all": ["vip", "spring-sale"] } },
    { "lastInteractionAt": { "$gte": "2026-04-01T00:00:00.000Z" } },
    { "chat.unread": true }
  ]
}
```

### Campaign

A campaign is one outbound bulk send record. It answers: what was sent, who it
was sent to, when it was sent, and what happened.

Shape:

```ts
type Campaign = {
  id: string
  oaId: string
  name: string
  messageType: "text"
  messageText: string
  audienceFilterId: string | undefined
  inlineAudienceQuery: AudienceQueryJson | undefined
  status: "draft" | "queued" | "sending" | "sent" | "failed" | "canceled"
  recipientSnapshotCount: number
  successCount: number
  failedCount: number
  quotaUsed: number
  createdByManagerId: string
  createdAt: string
  queuedAt: string | undefined
  sentAt: string | undefined
}
```

Phase 3A does not need a separate `CampaignRun` table. A campaign is one send.
If later phases add scheduling, repeated sends, or A/B tests, the model can add
campaign runs then.

### Recipient Snapshot

Audience filters are live queries. Campaign delivery must not be live. When a
manager sends a campaign, Vine resolves the audience query and stores a
recipient snapshot for that campaign.

The snapshot makes the send auditable and recoverable:

- later tag edits do not change who received an already-sent campaign;
- delivery retries know which recipients remain pending;
- counts and quota use are tied to the exact recipients selected at send time.

## Audience Query Language

Use a controlled Mongo-like predicate format instead of a TypeScript enum-style
rule AST.

Allowed operators for Phase 3A:

- implicit AND across object keys;
- `$and`;
- `$or`;
- `$not`;
- `$eq`;
- `$ne`;
- `$in`;
- `$nin`;
- `$all`;
- `$exists`;
- `$gt`;
- `$gte`;
- `$lt`;
- `$lte`.

Disallowed in Phase 3A:

- `$where`;
- arbitrary JavaScript execution;
- unbounded regex;
- text search;
- unknown operators;
- unknown fields;
- queries that exceed configured depth or branch limits.

Allowed fields for Phase 3A:

- `friendship.status`;
- `providerUserId`;
- `displayName`;
- `tags.ids`;
- `tags.names`;
- `lastInteractionAt`;
- `chat.status`;
- `chat.unread`;
- `note.exists`.

The OA boundary is never controlled by user-provided query JSON. All audience
queries are evaluated within the authenticated manager's OA scope.

Implementation should include a field registry that defines each allowed field,
its type, whether it can be indexed efficiently, and which operators it accepts.
The compiler can target SQL joins, Zero-derived server queries, or a canonical
search projection table, but the stored audience query remains the same.

## Phase 3A: Vine-Native Campaign MVP

### Manager UI

Add campaign and audience management under the OA manager area.

Audience filter management:

- list saved audience filters for one OA;
- create, rename, update, and delete filters;
- build filters through a structured UI backed by the controlled query
  language;
- show live or on-demand preview count;
- prevent saving queries that use unsupported fields or operators.

Campaign management:

- list campaigns with status, created time, audience name, recipient count, and
  delivery summary;
- create a new text campaign;
- select all current friends or a saved audience filter;
- preview recipient count before send;
- send the campaign;
- show queued, sending, sent, failed, or canceled status.

### Send Behavior

On send:

1. Validate manager ownership for the OA.
2. Validate campaign content and audience query.
3. Resolve recipients within the OA boundary.
4. Store recipient snapshot rows.
5. Check quota against recipient count.
6. Queue delivery jobs.
7. Count usage per recipient.
8. Update campaign status and delivery counts.

Repeated sends must be idempotent. A campaign that has already been queued or
sent cannot enqueue a second recipient snapshot unless a later spec introduces a
formal resend action.

### Message Scope

Phase 3A supports text campaign messages only. The text composer should reuse
existing message validation rules where possible, but the campaign composer is
not the full chat composer.

## Phase 3B: LINE-Compatible Messaging API Facade

Phase 3B exposes LINE-shaped external endpoints backed by the Phase 3A model.
The facade is an ingress and egress compatibility layer. It must not define
Vine's internal product model.

Likely supported subset:

- `POST /v2/bot/message/broadcast`
  - creates a Vine campaign with audience query for all current friends.
- `POST /v2/bot/message/multicast`
  - creates a Vine campaign with an inline explicit-recipient query.
- `POST /v2/bot/message/narrowcast`
  - compiles supported LINE recipient and filter DSL into a Vine audience query.
- `POST /v2/bot/audienceGroup/upload`
  - creates a Vine audience filter with explicit user IDs.
- `GET /v2/bot/audienceGroup/{id}`
  - returns LINE-shaped metadata for a Vine audience filter.
- `GET /v2/bot/insight/message/event?requestId=...`
  - returns campaign-level delivery or interaction stats when available.

Mapping direction:

| LINE concept | Vine model |
| --- | --- |
| `audienceGroupId` | `AudienceFilter.id` |
| upload user IDs audience | `AudienceFilter.query` over explicit provider user IDs |
| chat tag audience | `AudienceFilter.query` over `tags.ids` |
| broadcast | `Campaign` with all-current-friends query |
| multicast | `Campaign` with inline explicit-recipient query |
| narrowcast | `Campaign` compiled from LINE DSL into `AudienceQueryJson` |
| request ID | `Campaign.id` or send request ID |
| retry key | idempotency key for external campaign creation/send |
| custom aggregation unit | campaign aggregation key or stat key |

LINE narrowcast DSL can compile into `AudienceQueryJson` when the predicates are
supported:

- LINE `and` / `or` / `not` become `$and` / `$or` / `$not`.
- LINE `recipient.type = audience` references a saved Vine audience filter.
- LINE `recipient.type = redelivery` can later become a campaign-history
  predicate.
- LINE friendship duration can map to a supported contact field if Vine stores
  the needed timestamp.
- LINE `limit.max` and `limit.upToRemainingQuota` are campaign delivery options,
  not audience filter predicates.

Unsupported LINE-only predicates must fail explicitly. Vine must not silently
broaden a narrowcast request when it cannot evaluate a filter.

## Data Direction

Use Zero-synced data for manager-visible audience filters and campaign list
state where practical. Delivery execution and recipient snapshots should be
server-owned because they affect quota, idempotency, and retry behavior.

Likely entities:

- `oaAudienceFilter`;
- `oaCampaign`;
- `oaCampaignRecipient`;
- `oaCampaignDeliveryAttempt` if needed for retry diagnostics;
- `oaCampaignStat` if stats need a separate aggregation table.

Permissions follow the existing manager-owned OA pattern until Phase 6 roles are
available. Only the OA provider owner can create, read, update, delete, preview,
or send audience filters and campaigns.

## Testing

Add focused coverage for:

- audience query validation rejects unknown fields, unknown operators, excessive
  depth, and unsupported regex/text execution;
- audience query evaluation respects the OA boundary;
- tag-based filters use Phase 2 tag definitions and assignments correctly;
- preview counts match the recipient snapshot created at send time when no data
  changes occur between preview and send;
- send-time snapshot does not change after later tag or contact updates;
- campaign send is idempotent and cannot double-enqueue recipients;
- quota is counted per recipient;
- failed recipients update campaign counts without losing successful deliveries;
- manager UI supports creating audience filters and text campaigns;
- external Messaging API facade tests in Phase 3B map supported LINE payloads
  into Vine campaigns and reject unsupported predicates.

## Acceptance Criteria

Phase 3A is complete when:

- managers can create saved audience filters for one OA using the controlled
  Mongo-like query language;
- managers can preview audience counts;
- managers can create and send a text campaign to all current friends or a saved
  audience filter;
- each send stores a recipient snapshot;
- delivery counts and quota usage are visible on the campaign;
- Phase 2 CRM tags can be used in audience filters;
- user-side chat behavior remains unchanged except for receiving campaign
  messages.

Phase 3B is complete when:

- external LINE-shaped broadcast, multicast, narrowcast, and audience upload
  requests are accepted for the supported subset;
- supported LINE requests compile into Vine audience filters or campaigns;
- response IDs and retry keys behave consistently enough for API clients to
  retry safely;
- unsupported LINE-only audience features fail explicitly.
