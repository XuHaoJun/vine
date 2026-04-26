---
name: vine-dev-stack
description: Use when working on Vine locally with Docker Compose, debugging local startup, deciding whether to run `bun run dev`, or checking the `server`, `web`, and `zero` services. Trigger when the user mentions local dev, docker compose, `bun run dev`, service health, logs, ports `3000`/`3001`/`4948`, or asks how to restart the local stack.
---

# Vine Dev Stack

Vine local development is Docker Compose-first. Treat `docker-compose.yml` as the source of truth for how the app runs on a developer machine.

## Core Rule

Do not start `bun run dev` manually for frontend or backend work. The Compose stack already runs:

- `server` on `3001`
- `web` on `3000`
- `zero` on `4948` externally / `4848` in the container

Starting another dev server usually duplicates work, steals ports, and gives misleading logs.

## Services

| Service | Role | Notes |
| --- | --- | --- |
| `pgdb` | Postgres for local development | Exposed on `5533` |
| `migrate` | One-shot DB/bootstrap step | Must complete before `zero` |
| `zero` | Zero sync service | Depends on `migrate` and `pgdb` |
| `server` | Backend dev server | Runs `bun --watch ... src/index.ts` |
| `web` | Frontend dev server | Runs `bun run dev` inside Compose |

## Quick Start

```bash
bun install
docker compose up -d
docker compose ps
```

If the stack is already up, reuse it instead of starting anything new.

## Local Debug Workflow

### 1. Check stack health first

```bash
docker compose ps
```

Use this before starting, restarting, or testing anything. It tells you whether the problem is really in `web`, or whether `server`, `zero`, or `migrate` failed earlier.

### 2. Read the right logs

```bash
docker compose logs web
docker compose logs server
docker compose logs zero
docker compose logs migrate
```

Start with the service that looks broken, then check its dependencies:

- Broken page load or blank UI: inspect `web`, then `server`, then `zero`
- API failures: inspect `server`
- Sync/query weirdness: inspect `zero` and `server`
- Early boot failures: inspect `migrate` and `pgdb`

### 3. Restart only what needs help

```bash
docker compose restart web
docker compose restart server
```

Prefer targeted restarts over bringing the whole stack down.

### 4. Rebuild only when the environment is stale

```bash
docker compose down -v
docker compose up -d
```

Use this when local state looks corrupted or integration tests need a clean environment. `down -v` resets Compose volumes, including DB state.

## Common Tasks

### Start the stack

```bash
docker compose up -d
```

### Stop the stack

```bash
docker compose down
```

### Check whether `server`, `web`, and `zero` are healthy enough for integration tests

```bash
docker compose ps
docker compose logs server
docker compose logs web
docker compose logs zero
```

Do not start integration tests until those three services look healthy.

### After changing Zero schema

Run type generation from the schema package:

```bash
bun run --cwd packages/zero-schema zero:generate
```

For the full schema migration workflow, use the `zero-schema-migration` skill.

## Environment Notes

- `server` and `web` require `.env.docker-compose`
- `web` talks to the backend through `ONE_SERVER_URL=http://host.docker.internal:3001`
- `zero` forwards to the backend's Zero endpoints and depends on the backend being reachable

If `web` looks broken but the frontend logs are vague, check `server` and `zero` before assuming the UI itself is the root cause.

## Common Mistakes

- Running `bun run dev` directly from `apps/web` or `apps/server`
- Restarting the whole stack when only `web` or `server` needs a refresh
- Debugging the `web` container only, while `server`, `zero`, or `migrate` is the actual failure
- Running integration tests before confirming `server`, `web`, and `zero` are healthy
- Treating Zero schema generation as a full migration workflow instead of using `zero-schema-migration`

## Reference Files

- `docker-compose.yml`
- `.env.docker-compose`
- `packages/zero-schema/package.json`
