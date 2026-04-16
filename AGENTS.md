# Vine Agents Guide

Vine is a self-hostable instant-messaging product modeled after LINE. It is not the official LINE platform: avoid assuming LINE Developers Console, Messaging API, LINE Login with LY Corp app/channel IDs, or calling LINE's hosted `api.line.me` as an external integration target. Build features against this repo unless the user explicitly asks for real LINE cloud integration.

## Essential Commands

```bash
bun install
docker compose up -d
bun run build
bun run check:all
bun run format
bun run test
```

For repo-specific workflows, prefer the project skills below instead of inventing a new pattern from scratch.

## Skill Routing

### New repo-specific skills

| Skill | Use when |
| --- | --- |
| `vine-dev-stack` | local Docker Compose workflow, `bun run dev`, `server` / `web` / `zero` health, logs, restarts |
| `vine-frontend-patterns` | forms, auth UX, dialogs/toasts, `~/interface/*`, `useAuth()`, storage, frontend state patterns |
| `vine-server-patterns` | service factories, dependency injection, plugin boundaries, env/config flow in `apps/server` |
| `vine-testing` | test scope, unit vs integration decisions, where tests live, what not to test |
| `vine-data-fetching` | choosing between Zero, React Query, ConnectRPC, or raw `fetch()` |

### Existing project skills

| Skill | Use when |
| --- | --- |
| `tamagui` | Tamagui UI work, layout, spacing, tokens, RN-first flex behavior |
| `one` | OneJS routing, layouts, file conventions, loaders, API routes |
| `zero` | Zero schema, queries, mutations, permissions, relationships, sync behavior |
| `zero-schema-migration` | schema changes that need Zero generation or publication rebuild steps |
| `connect` | ConnectRPC proto, handlers, auth wrappers, clients, transport |
| `git-commit` | user explicitly asks for a git commit |

## Always-On Rules

- Frontend work in `apps/web`, `~/interface/`, or other Tamagui-based surfaces must read the `tamagui` skill first
- Local development uses Docker Compose; do not start extra frontend/backend dev servers unless the user explicitly wants a different workflow
- Do not use raw `fetch()` for normal server data in this repo; use `vine-data-fetching`, `zero`, or `connect` as appropriate
- Use `~/interface/*` for UI components instead of raw Tamagui imports
- Use `useAuth()` for auth gating and frontend auth state, not `useUser()`
- Zero mutations require caller-generated IDs and timestamps
- Zero relationships live in `packages/zero-schema/src/relationships.ts`

## Architecture

- Monorepo: turborepo + bun workspaces
- Web/native app: One (vxrn)
- UI: Tamagui with shared app components in `~/interface/`
- Data: Zero sync layer + Drizzle DB schema
- Auth: better-auth
- RPC: ConnectRPC

## Project Structure

```text
apps/web/              One app for web + native
apps/server/           Fastify + ConnectRPC server
packages/zero-schema/  Zero models, queries, mutations
packages/db/           Drizzle database schema
packages/proto/        Protobuf definitions
packages/liff-fixtures/  Static LIFF integration-test fixtures (served by apps/server)
```

## Global Code Style

- Formatter: oxfmt
- Linter: oxlint with react, import, and typescript plugins
- Imports: external -> internal package -> `~` alias -> relative -> types/styles
- Components and types: PascalCase
- Hooks: camelCase with `use` prefix
- Prefer `type` over `interface`
- Use explicit `string | undefined` instead of `string?` when modeling unions
- Prefer `as const` for literal values
- Use `.native.ts` / `.native.tsx` for platform-specific files

### Environment Variables

- Client-visible variables must use the `VITE_` prefix
- Server-only variables must not be exposed to the client
- Use `dotenvx` for environment management
- Add new env vars to the relevant `package.json` env validation section

## Data And Frontend Conventions

- Import Zero queries from `@vine/zero-schema/queries/*`
- Prefer `vine-frontend-patterns` for forms, auth, toast/dialog, and storage decisions
- Prefer `vine-data-fetching` for picking Zero vs React Query vs ConnectRPC
- Prefer `zero` for deeper Zero implementation details
- Prefer `connect` for RPC implementation details

## learn-projects Exclusion

`learn-projects/` contains reference implementations for learning and should not be modified.

- `.oxlintrc.json` and `.oxfmtrc.jsonc` must ignore `learn-projects/**`
- Do not run lint or format commands inside `learn-projects/`
- Do not commit dirty submodule changes from `learn-projects/`
- `learn-projects/` is not part of bun workspaces

## CI/CD

GitHub Actions runs three main jobs:

| Job | Purpose | Skip condition |
| --- | --- | --- |
| `check` | `bun check:all` | commit or PR title contains `docs:` |
| `test-server` | `bun run --cwd apps/server test` | commit or PR title contains `docs:` |
| `integration` | `bun scripts/integration.ts` | commit or PR title contains `docs:` |

Important notes:

- the install action sets up Node, Bun, `libreadline-dev`, install, postinstall, and build
- integration needs the required secrets and env setup
- `docs:` commits intentionally skip the CI jobs above

## Git Conventions

- Use conventional commit prefixes such as `feat:`, `fix:`, and `chore:`
- Keep commits atomic
- Never commit secrets, keys, or `.env` files
- Run relevant checks before committing
