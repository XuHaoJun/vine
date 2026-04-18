# @vine/liff-fixtures

Static HTML/JS fixtures for LIFF integration tests. No UI framework: pages are built with `bun build` and served by `apps/server` under `/fixtures/liff/*`.

## Build

From repo root:

```bash
bun run build --cwd packages/liff-fixtures
```

Output is written to `dist/` (gitignored). The server must be built or run after this so fixture files exist on disk.

## See also

- [apps/server/src/plugins/liff-fixtures-public.ts](../../apps/server/src/plugins/liff-fixtures-public.ts)
