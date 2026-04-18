# Vine

A self-hostable, LINE-style instant-messaging product built as a cross-platform monorepo.

> **Note**: Vine is **not** the official LINE platform. It is a standalone, open product that ships its own server, sync layer, and mobile/web clients. There is no dependency on LINE Developers Console, Messaging API, or `api.line.me`.

> **Starter template**: Vine is bootstrapped from the [`tamagui/takeout-free`](https://github.com/tamagui/takeout-free) stack (One + Zero + Tamagui + Better Auth + Drizzle), then restructured into a Turborepo monorepo and extended with a Fastify + ConnectRPC server, LIFF-style mini apps, and LINE-style Flex Messages / Rich Menus.

## Stack

At a high level, the primary technologies used are:

- [One](https://onestack.dev) — Universal React framework (web + iOS + Android)
- [Zero](https://zero.rocicorp.dev) — Local-first real-time sync
- [Tamagui](https://tamagui.dev) — Universal UI
- [Better Auth](https://www.better-auth.com) — Authentication
- [Drizzle ORM](https://orm.drizzle.team) — Database schema and migrations
- [Fastify](https://fastify.dev) — Backend HTTP server
- [ConnectRPC](https://connectrpc.com) — Type-safe RPC over Protobuf
- [Turborepo](https://turborepo.com) + [Bun](https://bun.sh) workspaces — Monorepo tooling
- [oxlint](https://oxc.rs) + [oxfmt](https://oxc.rs) — Lint and format

## Prerequisites

Before you begin, ensure you have:

- **Bun** `1.3.9` — [Install Bun](https://bun.sh)
- **Node** `24.3.0` (matches `engines.node`)
- **Docker** — [Install Docker](https://docs.docker.com/get-docker/) (on macOS, [OrbStack](https://orbstack.dev) is recommended)
- **Git** — for version control

For mobile development:

- **iOS**: macOS with Xcode 16+
- **Android**: Android Studio with JDK 17+

## Quick Start

```bash
bun install
bun run backend     # starts postgres, migrate, zero, server, and web in docker compose
```

The dockerized stack exposes:

| Service   | URL / Port                                            |
| --------- | ----------------------------------------------------- |
| Web (One) | <http://localhost:3000>                               |
| Server    | <http://localhost:3001>                               |
| Zero      | <http://localhost:4948>                               |
| Postgres  | `postgresql://user:password@localhost:5533/postgres`  |

> Local development is driven by `docker compose`. You normally do **not** need to run `bun run dev` separately — the `web` and `server` services already run their own dev processes inside the compose stack.

## Architecture

Vine is a **Turborepo monorepo** managed with Bun workspaces:

```
vine/
├── apps/
│   ├── web/                  # One (vxrn) app — web + iOS + Android
│   └── server/               # Fastify + ConnectRPC + Better Auth + Zero push/pull
├── packages/
│   ├── db/                   # Drizzle schema, migrations, seed scripts
│   ├── zero-schema/          # Zero models, queries, mutations, permissions
│   ├── proto/                # Protobuf definitions and generated TS code
│   ├── drive/                # File storage abstraction (S3/R2)
│   ├── liff/                 # LIFF-style mini app SDK
│   ├── liff-fixtures/        # Static LIFF fixtures (served by apps/server in tests)
│   ├── line-flex/            # LINE-style Flex Message renderer
│   ├── flex-schema/          # Flex Message schema definitions
│   └── richmenu-schema/      # Rich Menu schema definitions
├── docs/                     # Project documentation
├── learn-projects/           # Reference implementations (read-only, not part of workspaces)
├── scripts/                  # CI helpers (e.g. integration runner)
├── docker-compose.yml        # Local backend + frontend dev stack
└── turbo.json                # Turborepo pipeline config
```

### Apps

| App            | Description                                                                |
| -------------- | -------------------------------------------------------------------------- |
| `@vine/web`    | One (vxrn) cross-platform app — web + iOS + Android, built with Tamagui    |
| `@vine/server` | Fastify HTTP server with ConnectRPC, Better Auth, and Zero push/pull endpoints |

### Packages

| Package                  | Description                                                       |
| ------------------------ | ----------------------------------------------------------------- |
| `@vine/db`               | Drizzle ORM schema, migrations, and seed utilities                |
| `@vine/zero-schema`      | Zero sync models, queries, mutations, and permissions             |
| `@vine/proto`            | Protobuf definitions + buf-generated TypeScript clients/services  |
| `@vine/drive`            | File storage abstraction (local / S3 / Cloudflare R2)             |
| `@vine/liff`             | LIFF-style mini-app SDK consumed by `apps/web`                    |
| `@vine/liff-fixtures`    | Static LIFF fixtures served by `apps/server` for integration tests |
| `@vine/line-flex`        | LINE-style Flex Message renderer                                  |
| `@vine/flex-schema`      | Type-safe Flex Message schema                                     |
| `@vine/richmenu-schema`  | Type-safe Rich Menu schema                                        |

## Common Commands

```bash
# local stack
bun run backend                # start full stack via docker compose
bun run backend:clean          # stop stack and remove volumes/local images

# turbo pipelines
bun run dev                    # run dev tasks for everything (rarely needed; compose already runs them)
bun run build                  # build all packages and apps
bun run clean                  # clean turbo + per-package outputs

# code quality
bun run check                  # type-check (tko)
bun run check:all              # type-check including learn-projects
bun run lint                   # oxlint
bun run format                 # oxfmt
bun run format:check           # oxfmt --check

# testing
bun run test                   # all tests via turbo
bun run test:unit              # unit tests only
bun run test:integration       # integration tests (requires the docker stack)
```

## Database

### Local Development

PostgreSQL (with `pgvector`) runs in Docker on **port 5533**:

- Main database: `postgresql://user:password@localhost:5533/postgres`
- Zero sync databases: `zero_cvr` and `zero_cdb` (created automatically by the `migrate` service)

### Migrations

Update your schema in `packages/db/src/`:

- `schema-public.ts` — public tables exposed to Zero / clients
- `schema-private.ts` — server-only tables

Migrations run automatically as the `migrate` service in `docker-compose.yml` (it builds and executes `migrate-dist.js` against the DB before `zero` starts).

### Zero Schema

Zero models, queries, mutations, and relationships live in `packages/zero-schema/src/`. After adding or changing models, regenerate the schema artifacts as documented in the `zero` and `zero-schema-migration` skills.

## Environment Configuration

### File Structure

- `.env.development` — development defaults (committed)
- `.env.docker-compose` — env file consumed by docker compose services
- `.env.local` — personal secrets / overrides (gitignored)
- `.env.production` — production config (gitignored)
- `.env.production.example` — production template (committed)

Vine uses [`dotenvx`](https://dotenvx.com) for environment management. Client-visible variables **must** use the `VITE_` prefix; server-only secrets must never be exposed to the client.

### Key Variables

```bash
# auth
BETTER_AUTH_SECRET=<secret>
BETTER_AUTH_URL=<url>

# server
ONE_SERVER_URL=<url>

# zero
ZERO_UPSTREAM_DB=<connection-string>
ZERO_CVR_DB=<connection-string>
ZERO_CHANGE_DB=<connection-string>

# storage (S3 / R2)
CLOUDFLARE_R2_ENDPOINT=<endpoint>
CLOUDFLARE_R2_ACCESS_KEY=<key>
CLOUDFLARE_R2_SECRET_KEY=<secret>
```

See `.env.production.example` for the full production configuration.

## Mobile Apps

### iOS

```bash
bun --cwd apps/web ios
```

Requires macOS, Xcode 16+, and iOS 17.0+ deployment target.

### Android

```bash
bun --cwd apps/web android
```

Requires Android Studio, JDK 17+, and Android SDK 34+.

## Adding Features

### Data Models

1. Add schema to `packages/db/src/schema-public.ts`
2. Restart the docker stack (the `migrate` service applies it)
3. Add the corresponding Zero model under `packages/zero-schema/src/models/`
4. Add relationships in `packages/zero-schema/src/relationships.ts`
5. Regenerate Zero artifacts (see the `zero-schema-migration` skill)
6. Use queries from `@vine/zero-schema/queries/*` in your components

### ConnectRPC Endpoints

1. Add `.proto` files to `packages/proto/proto/`
2. Run `proto:generate` (see the `connect` skill)
3. Implement service handlers in `apps/server/`
4. Call them from `apps/web/` via the generated clients

### UI Components

Reusable cross-platform components live in `apps/web/src/interface/`. Prefer importing from `~/interface/*` instead of importing directly from Tamagui.

### Icons

Vine uses [Phosphor Icons](https://phosphoricons.com/). Icons live in `apps/web/src/interface/icons/phosphor/`.

## Data Fetching

Vine has three first-class ways to talk to the server. Pick one based on the use case (see the `vine-data-fetching` skill for the full decision tree):

- **Zero** — synced, local-first reads/writes for app data (chats, messages, friendships, todos)
- **ConnectRPC** — typed RPC for one-shot or streaming operations that don't fit Zero's model
- **React Query (TanStack Query)** — server state that is not synced via Zero

Raw `fetch()` is **not** the default and should be avoided for normal server data.

## CI/CD

GitHub Actions runs three main jobs:

| Job             | Purpose                                | Skip condition                               |
| --------------- | -------------------------------------- | -------------------------------------------- |
| `check`         | `bun run check:all`                    | commit / PR title contains `docs:`           |
| `test-server`   | `bun run --cwd apps/server test`       | commit / PR title contains `docs:`           |
| `integration`   | `bun scripts/integration.ts`           | commit / PR title contains `docs:`           |

The install action sets up Node, Bun, `libreadline-dev`, then runs install + postinstall + build. The `integration` job needs the required secrets and env to be present.

## Contributing

- Use conventional commit prefixes: `feat:`, `fix:`, `chore:`, `docs:`, etc.
- Keep commits atomic.
- Run `bun run check`, `bun run lint`, and `bun run format` before pushing.
- Never commit `.env*` files or secrets.
- Do not modify anything under `learn-projects/` — it is a read-only set of reference implementations.

## License

MIT
