# Vine

> **[Takeout Pro](https://tamagui.dev/takeout)** - The full version with more features, templates, and support.

> **⚠️ v2-beta** - This stack is in active development. APIs may change.

A full-stack, cross-platform starter kit built on a Turborepo monorepo architecture with React Native, Fastify, and ConnectRPC.

## Prerequisites

Before you begin, ensure you have:

- **Bun** - [Install Bun](https://bun.sh)
- **Docker** - [Install Docker](https://docs.docker.com/get-docker/) (on macOS, we recommend [OrbStack](https://orbstack.dev) as a faster alternative)
- **Git** - For version control

For mobile development:

- **iOS**: macOS with Xcode 16+
- **Android**: Android Studio with JDK 17+

## Quick Start

```bash
bun install
bun backend      # start docker services (postgres, zero)
bun dev          # start all apps (web dev server at http://localhost:8092)
```

## Stack

At a high level, the primary technologies used are:

- [One](https://onestack.dev) - Universal React framework
- [Zero](https://zero.rocicorp.dev) - Real-time sync
- [Tamagui](https://tamagui.dev) - Universal UI
- [Better Auth](https://www.better-auth.com) - Authentication
- [Drizzle ORM](https://orm.drizzle.team) - Database schema
- [Fastify](https://fastify.dev) - Backend server
- [ConnectRPC](https://connectrpc.com) - Type-safe RPC

## Architecture

This project uses a **Turborepo monorepo** structure:

```
vine/
├── apps/
│   ├── web/              # One app (web + native)
│   └── server/           # Fastify + ConnectRPC server
├── packages/
│   ├── db/               # Drizzle database schema
│   ├── proto/            # Protobuf definitions & generated code
│   └── zero-schema/      # Zero models, queries, mutations
├── docker-compose.yml    # Local backend services
└── turbo.json            # Turborepo pipeline config
```

### Apps

| App | Description |
| --- | --- |
| `@vine/web` | One (vxrn) cross-platform app — web + iOS + Android |
| `@vine/server` | Fastify server with ConnectRPC endpoints, Better Auth, Zero sync |

### Packages

| Package | Description |
| --- | --- |
| `@vine/db` | Drizzle ORM schema and database utilities |
| `@vine/proto` | Protobuf definitions, buf code generation |
| `@vine/zero-schema` | Zero sync layer models, queries, and mutations |

## Common Commands

```bash
# development
bun dev                      # start all apps via turbo
bun ios                      # run iOS simulator
bun android                  # run Android emulator
bun backend                  # start docker services

# code quality
bun check                    # typescript type checking
bun lint                     # run oxlint
bun format                   # run oxfmt
bun format:check             # check formatting without changes

# testing
bun test                     # run all tests

# build
bun build                    # build all packages

# database
bun migrate                  # build and run migrations

# deployment
bun ci --dry-run             # run full CI pipeline without deploy
bun ci                       # full CI/CD with deployment
```

## Database

### Local Development

PostgreSQL runs in Docker on port 5444:

- Main database: `postgresql://user:password@localhost:5444/postgres`
- Zero sync databases: `zero_cvr` and `zero_cdb`

### Migrations

Update your schema in:

- `packages/db/src/schema-public.ts` - Public tables (exposed to Zero/client)
- `packages/db/src/schema-private.ts` - Private tables

Then run:

```bash
bun migrate
```

### Zero Schema

After adding new Zero models:

```bash
bun --cwd packages/zero-schema run zero:generate
```

## Environment Configuration

### File Structure

- `.env.development` - Development defaults (committed)
- `.env` - Active environment (generated, gitignored)
- `.env.local` - Personal secrets/overrides (gitignored)
- `.env.production` - Production config (gitignored)
- `.env.production.example` - Production template (committed)

### Key Variables

```bash
# authentication
BETTER_AUTH_SECRET=<secret>
BETTER_AUTH_URL=<url>

# server
ONE_SERVER_URL=<url>

# zero
ZERO_UPSTREAM_DB=<connection-string>
ZERO_CVR_DB=<connection-string>
ZERO_CHANGE_DB=<connection-string>

# storage (S3/R2)
CLOUDFLARE_R2_ENDPOINT=<endpoint>
CLOUDFLARE_R2_ACCESS_KEY=<key>
CLOUDFLARE_R2_SECRET_KEY=<secret>
```

See `.env.production.example` for complete production configuration.

## Mobile Apps

### iOS

```bash
bun ios          # run in simulator
```

Requires macOS, Xcode 16+, and iOS 17.0+ deployment target.

### Android

```bash
bun android      # run in emulator
```

Requires Android Studio, JDK 17+, and Android SDK 34+.

## Adding Features

### Data Models

1. Add schema to `packages/db/src/schema-public.ts`
2. Run `bun migrate`
3. Add Zero model to `packages/zero-schema/src/models/`
4. Run `bun zero:generate`
5. Use queries in your components

### Protobuf / ConnectRPC

1. Add `.proto` files to `packages/proto/proto/`
2. Run `bun --cwd packages/proto run proto:generate`
3. Implement service handlers in `apps/server/`
4. Create clients in `apps/web/`

### UI Components

Reusable components live in `apps/web/src/interface/`. Use components from there rather than importing directly from Tamagui when possible.

### Icons

This project uses [Phosphor Icons](https://phosphoricons.com/). Icons are in `apps/web/src/interface/icons/phosphor/`.

## License

MIT
