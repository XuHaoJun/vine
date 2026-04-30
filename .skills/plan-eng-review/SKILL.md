---
name: plan-eng-review
description: Use only when the user explicitly invokes `/plan-eng-review`, asks for gstack engineering plan review, architecture review of a plan, or technical review before implementation.
---

# Plan Engineering Review

`/plan-eng-review` is the manual architecture gate for Vine implementation plans. It complements `superpowers:writing-plans`: writing-plans creates the step-by-step plan, `/plan-eng-review` checks whether that plan is architecturally sound before code changes begin.

Do not use this skill for ordinary code edits. The user should explicitly request `/plan-eng-review` or an engineering plan review.

## Inputs

Prefer the first available source:

1. A plan file path named by the user.
2. The active `docs/superpowers/plans/*` file referenced in conversation.
3. A pasted implementation plan.

If no plan is available, ask for it. Do not review stale plan files by recency alone.

## Required Context

Before reviewing, read the plan and the existing code it names. If the plan touches a Vine subsystem, use the relevant repo skill:

- UI or Tamagui: `tamagui` plus `vine-frontend-patterns`.
- One routes/loaders/navigation: `one`.
- Zero schema, queries, mutations, permissions, synced entities: `zero`; use `zero-schema-migration` for schema changes.
- Data fetching choice: `vine-data-fetching`.
- ConnectRPC/proto/service handlers: `connect`.
- Server service factories, DI, plugin wiring: `vine-server-patterns`.
- Test strategy: `vine-testing`.

## Review Passes

### 1. Scope Challenge

Check whether the same goal can be met with fewer files, fewer new abstractions, or more reuse of current Vine code. Flag overbroad plans, but do not silently change scope.

### 2. Architecture

Check boundaries and data flow:

- Where does data originate, transform, persist, sync, and render?
- Are Zero, ConnectRPC, React Query, and Drizzle used in the right places?
- Are auth and permission checks at the correct layer?
- Does the plan create duplicate services, state, schemas, or UI components?
- Does it avoid assumptions about LINE cloud APIs unless explicitly requested?

### 3. Failure Modes

Map realistic failures:

- invalid input
- missing auth/session
- stale or conflicting synced data
- migration drift
- network or RPC failure
- optimistic update convergence
- mobile/web platform difference

### 4. Test Plan

Use `vine-testing` conventions. Every risky branch should map to a test type and command. Prefer focused unit tests unless the risk requires DB integration or Playwright.

### 5. Performance And Operations

Check N+1 queries, excessive Zero subscriptions, unbounded lists, blocking startup work, Docker/local-dev impact, and CI cost.

## Output Format

```markdown
## /plan-eng-review

Input: <plan file or pasted plan>
Verdict: READY | READY_WITH_CHANGES | BLOCKED

### Scope
- <finding or "No issues">

### Architecture
- [P1/P2/P3] <issue> — Recommendation: <specific change>

### Failure Modes
- <gap and proposed handling>

### Test Coverage
- Unit: <files/commands>
- Integration: <files/commands or "not needed">
- Playwright: <flows or "not needed">

### Plan Amendments
- <specific edit to make before implementation>

### Open Decisions
- <decision only if user input is required>
```

Only edit the plan after the user asks you to apply the amendments. When editing, keep the original superpowers checkbox task structure intact.
