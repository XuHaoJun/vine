---
name: review
description: Use only when the user explicitly invokes `/review`, asks for gstack review, pre-landing review, final diff audit, or a PR/diff review workflow.
---

# Review

`/review` is the manual pre-landing diff audit for Vine. It complements `superpowers:requesting-code-review`: superpowers review is useful during task execution, while `/review` checks the final branch against intent before merge.

If the user simply asks "review" without naming code, default to normal code-review stance. Use this skill when they invoke `/review`, ask for gstack review, or ask for a pre-landing diff audit.

## Setup

Detect the base branch with git-native commands first:

```bash
git symbolic-ref refs/remotes/origin/HEAD 2>/dev/null | sed 's|refs/remotes/origin/||'
git rev-parse --verify origin/main 2>/dev/null
git rev-parse --verify origin/master 2>/dev/null
```

Then inspect:

```bash
git branch --show-current
git diff origin/<base>...HEAD --stat
git diff origin/<base>...HEAD
git log origin/<base>..HEAD --oneline
```

Do not review `learn-projects/**` changes as part of Vine work.

## Review Passes

### 1. Scope Drift

Compare the diff to the stated request, plan file, commits, and `TODOS.md` if relevant. Flag unrelated refactors, missing plan items, partial implementations, and generated churn.

### 2. Correctness And Safety

Find concrete bugs first:

- auth/permission bypasses
- Zero mutation ID/timestamp mistakes
- missing Zero relationship/schema updates
- DB migration drift
- ConnectRPC contract mismatches
- raw `fetch()` where Vine data patterns should be used
- web/native platform regressions
- race conditions, stale state, optimistic update failures

### 3. Tests

Use `vine-testing` to judge whether the changed behavior has the right level of coverage. Missing regression coverage is a finding when the diff fixes or changes existing behavior.

### 4. Maintainability

Flag overbroad abstractions, duplicated logic, unclear boundaries, and changes that violate repo conventions. Do not nitpick formatting that the formatter handles.

## Output Rules

Lead with findings, ordered by severity. Include file and line references when possible. If there are no findings, say that clearly and mention residual test risk.

Use this format:

```markdown
## /review Findings

### Critical
- <file:line> <issue, impact, fix>

### Important
- <file:line> <issue, impact, fix>

### Minor
- <file:line> <issue, impact, fix>

### Scope Check
- CLEAN | DRIFT | MISSING REQUIREMENTS — <summary>

### Tests
- Ran: <commands or "not run">
- Gaps: <remaining gaps>
```

Do not auto-fix review findings unless the user asks. If asked to fix, make surgical changes and verify with the narrowest relevant commands.
