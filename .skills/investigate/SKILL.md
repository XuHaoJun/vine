---
name: investigate
description: Use only when the user explicitly invokes `/investigate`, asks for gstack investigate, root-cause investigation, or a manual debugging investigation workflow.
---

# Investigate

`/investigate` is a Vine-specific wrapper around `superpowers:systematic-debugging`. It is for manual root-cause debugging when the user wants the gstack-style investigation report.

If a bug, test failure, or unexpected behavior appears without an explicit `/investigate` request, use `superpowers:systematic-debugging` normally. Use this skill only for the manual command or exact workflow request.

## Iron Rule

No fixes before root cause evidence. Do not patch symptoms, broaden scope, or refactor adjacent code while investigating.

## Workflow

### 1. Collect Symptoms

Gather the exact error, stack trace, failing command, reproduction steps, environment, and whether this worked before. Ask one concise question if required evidence is missing.

### 2. Trace The Code Path

Use `rg` and direct file reads to trace from symptom to likely source. Check recent changes with:

```bash
git log --oneline -20 -- <affected-files>
git diff
```

For Vine, identify the layer involved: web UI, One route, Zero query/mutation, ConnectRPC, server service, Drizzle/DB, Docker/dev stack, or integration fixture.

### 3. Form A Testable Hypothesis

State one hypothesis:

```text
Root cause hypothesis: <specific claim> because <evidence>.
```

Then test that hypothesis with the smallest reproduction, diagnostic, or failing test. If the hypothesis fails, discard it and gather more evidence.

### 4. Fix Narrowly

After the root cause is confirmed:

- make the smallest change that fixes the source
- add or update a regression test when feasible
- keep edits limited to the affected module unless evidence proves the root cause spans layers
- use the relevant Vine skill for touched areas

### 5. Verify

Re-run the original reproduction and the narrow test command. Run broader checks only when the blast radius justifies it.

## Report Format

```markdown
## /investigate Report

Status: DONE | DONE_WITH_CONCERNS | BLOCKED
Symptom: <what failed>
Root Cause: <confirmed cause>
Evidence: <command/output summary or code evidence>
Fix: <file:line and behavior changed>
Regression Test: <file/command or "not added: reason">
Verification: <commands run and result>
Residual Risk: <anything still uncertain>
```

If three hypotheses fail, stop and report what was ruled out. Ask whether to continue investigating, add instrumentation, or escalate for human domain context.
