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

Then get graph context before reading large diffs. Code Review Graph is an orientation and risk-ranking layer; the git diff remains the source of truth.

Use the MCP tools with repo auto-detection. Do not hardcode personal absolute paths; if a tool needs `repo_root`, use the current repo root from the active workspace.

Start every graph-assisted review with:

```text
get_minimal_context_tool(task="pre-landing Vine review", base="origin/<base>")
detect_changes_tool(base="origin/<base>", detail_level="minimal")
```

Use `detail_level="minimal"` by default. Escalate only when the minimal result leaves a concrete review question unanswered:

- `detect_changes_tool(detail_level="standard")` for medium/high risk changes with unclear priorities
- `get_review_context_tool(detail_level="minimal", include_source=false)` for changed-node and blast-radius context
- `get_affected_flows_tool()` for user-facing execution paths touched by the diff
- `get_impact_radius_tool(detail_level="minimal")` for shared modules or high-degree changes
- `query_graph_tool(pattern="tests_for", target="<function>")` for high-risk changed functions with suspected coverage gaps

Keep graph usage bounded: target 2-5 graph calls, then verify findings against the actual diff and source files. Do not report a finding solely because the graph summary says it is risky; convert graph signals into concrete code-review evidence with file and line references.

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

Use Code Review Graph review priorities to decide which files and functions to inspect first, especially when the diff is large.

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

Use Code Review Graph test-gap output as a starting point, then verify by inspecting existing tests or running targeted test searches. Treat graph-reported gaps as leads, not proof.

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
