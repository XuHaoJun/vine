---
name: vine-server-patterns
description: Use when adding or refactoring backend code in Vine, especially service factories, dependency injection, Fastify plugin wiring, and environment/config flow. Trigger when the user mentions `createXxxService`, `deps`, singletons, `process.env` in services, `index.ts` wiring, plugin boundaries, or asks how server architecture works in `apps/server`.
---

# Vine Server Patterns

Vine server code is built around manual dependency injection and explicit wiring in the app entrypoint. Favor small, pure service factories over hidden global state.

## Core Rules

- Do not use module-level singletons
- Assemble dependencies in `apps/server/src/index.ts`
- Pass dependencies into services and plugins explicitly with `deps`
- Read environment variables in the entrypoint, then pass concrete values down
- Keep plugin boundaries clean; plugins should not import each other directly

## Service Shape

The default shape is a factory function:

```ts
type AuthDeps = {
  database: Pool
  db: NodePgDatabase<typeof schema>
}

export function createAuthService(deps: AuthDeps) {
  return {
    async signIn(...) {
      // use deps.database / deps.db
    },
  }
}
```

This keeps the service easy to test because you can pass mocked dependencies directly.

## Wiring Flow

```text
entrypoint config + infra
  -> create service factories
  -> pass services into plugins
  -> register routes/plugins on Fastify
```

### Entrypoint example

```ts
const database = getDatabase()
const db = createDb()

const auth = createAuthService({ database, db })
const zero = createZeroService({
  auth,
  zeroUpstreamDb: process.env['ZERO_UPSTREAM_DB'] ?? '',
})

await authPlugin(app, { auth })
await zeroPlugin(app, { auth, zero })
```

Read the env in the entrypoint, not from inside `createAuthService()` or `createZeroService()`.

## Plugin Pattern

Plugins should depend on already-built services:

```ts
async function authPlugin(
  fastify: FastifyInstance,
  deps: { auth: ReturnType<typeof createAuthService> },
) {
  // register routes using deps.auth
}
```

This keeps route registration separate from dependency construction.

## Where ConnectRPC Fits

Use this skill for service and plugin structure. If the change is specifically about proto definitions, handler registration, auth wrappers like `withAuthService`, or Connect clients, switch to the `connect` skill.

## Environment Handling

### Good

- read `process.env` in `apps/server/src/index.ts`
- convert or validate config there
- pass values through `deps`

### Bad

- reading `process.env` inside a service factory
- reading env lazily inside route handlers
- importing a singleton config object that hides where state comes from

## Why This Pattern Exists

- It makes services easy to unit test with mocked deps
- It avoids hidden startup order problems
- It keeps boundaries visible when the server grows
- It prevents plugin coupling and accidental global state

## Common Mistakes

- `let instance: Service | null` plus `getInstance()`
- Services importing each other directly instead of receiving collaborators through `deps`
- A plugin creating its own service instead of receiving one from the entrypoint
- Service code reaching into `process.env`
- Mixing transport wiring concerns and business logic in the same module without clear boundaries

## Reference Files

- `apps/server/src/index.ts`
- `apps/server/src/connect/routes.ts`
- `apps/server/src/connect/oa.ts`
- `apps/server/src/services/`
- `apps/server/src/plugins/`
