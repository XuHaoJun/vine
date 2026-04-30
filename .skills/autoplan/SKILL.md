---
name: autoplan
description: Use only when the user explicitly invokes `/autoplan`, asks for autoplan, auto plan, automatic plan review, or asks to run the gstack product review gate on a spec or plan.
---

# Autoplan

`/autoplan` is the manual product review gate for Vine specs and plans. It complements `superpowers:brainstorming`: brainstorming creates the design, `/autoplan` challenges the product shape before engineering planning or implementation begins.

Do not use this skill just because a task involves planning. The user should explicitly ask for `/autoplan` or automatic plan review.

## Inputs

Prefer the first available source:

1. A file path named by the user.
2. The current `docs/superpowers/specs/*` or `docs/superpowers/plans/*` file referenced in the conversation.
3. The current conversation's proposed design or plan.

If the input is ambiguous, ask for the target file or pasted plan. Do not guess across unrelated recent files.

## Review Lens

Review from a product and scope perspective, not an implementation-detail perspective.

Check:

- User problem: is the plan solving a real user-visible problem in Vine?
- Scope: what is essential, what is speculative, and what should be explicitly out of scope?
- Vine fit: does it respect Vine as a standalone LINE-like product, not LINE's official cloud platform?
- Existing product surface: does it reuse current Vine concepts, navigation, auth, Zero sync, and RPC boundaries?
- Acceptance criteria: can a reviewer tell when the work is done?
- Risks: migration risk, privacy/security impact, confusing UX states, integration test needs.
- Tradeoffs: identify decisions where two reasonable approaches exist.

## Decision Rules

Use these in order:

1. Minimum product surface that solves the stated user problem.
2. Prefer existing Vine patterns over new concepts.
3. Prefer explicit acceptance criteria over broad aspirations.
4. Reject speculative flexibility unless the plan proves it is needed now.
5. Keep deferred work visible in `TODOS.md` or an explicit "Out of scope" section.

## Output Format

Return a concise review:

```markdown
## /autoplan Review

Input: <file or conversation>
Verdict: READY | READY_WITH_CHANGES | NEEDS_DECISION

### Product Fit
- <finding or "No issues">

### Scope
- <finding or "No issues">

### Acceptance Criteria
- <missing or revised criteria>

### Decisions
- [NEEDS USER] <decision, options, recommendation>
- [AUTO] <minor decision already resolved in the recommendation>

### Recommended Plan Edits
- <specific edit>
```

Only edit the spec or plan if the user explicitly asks you to apply the recommended edits. If you edit, keep changes surgical and preserve superpowers plan/spec structure.
