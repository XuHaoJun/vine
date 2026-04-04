---
name: one
description: >
  OneJS (one / vxrn) framework guide for this turborepo (vine). Use when working
  with OneJS routing, file conventions, loaders, SSR/SSG/SPA modes, API routes,
  cross-platform (isWeb/isNative) branching, navigation hooks, or middleware.
  Trigger whenever the user mentions "one", "vxrn", routing in apps/web, adding
  a new page/route, loader data fetching, or anything about the OneJS file-based
  router — even if they don't say "OneJS" explicitly.
---

# OneJS Guide

OneJS is a full-stack React framework built on Vite/vxrn that supports web + React Native from one codebase. It uses a file-based router similar to Next.js App Router but with its own conventions.

**Key imports:** everything comes from `'one'`.

---

## File Conventions

```
app/
  _layout.tsx          # Root layout (wraps all routes)
  _middleware.ts        # Server middleware (web only)
  +not-found.tsx        # 404 page
  index+ssg.tsx         # Static page at /
  hello+spa.tsx         # SPA page at /hello
  (app)/               # Route group (doesn't affect URL)
    _layout.tsx        # Layout for this group
    home/
      index.tsx        # /home — default rendering mode
      settings/
        index.tsx      # /home/settings
  api/
    users+api.ts       # API route at /api/users
    users/[id]+api.ts  # API route at /api/users/:id
  blog/
    [slug]+ssg.tsx     # Dynamic SSG route at /blog/:slug
    [...path]+ssr.tsx  # Catch-all SSR route
```

### Rendering mode suffixes

Append to filename **before** the extension:

| Suffix | Mode | Notes |
|--------|------|-------|
| (none) | SSR | Default — server-rendered on each request |
| `+ssr` | SSR | Explicit server-side rendering |
| `+ssg` | SSG | Statically generated at build time |
| `+spa` | SPA | Client-only, no server render |
| `+api` | API | HTTP endpoint, exports GET/POST/etc. |

### Special prefixes

- `_layout.tsx` — wraps child routes with Slot
- `_middleware.ts` — intercepts all requests under this directory
- `+not-found.tsx` — rendered when no route matches
- `.native.tsx` — overrides the base file on React Native only

---

## Layouts

Layouts use `Slot` to render the matched child route. The root layout must render full `<html>` on web:

```tsx
// app/_layout.tsx
import { Slot } from 'one'

export function Layout() {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <link rel="icon" href="/favicon.svg" />
      </head>
      <body>
        <Slot />
      </body>
    </html>
  )
}
```

Nested layouts just use `Slot` without html wrapping:

```tsx
// app/(app)/_layout.tsx
import { Slot } from 'one'

export function AppLayout() {
  return (
    <>
      <Header />
      <Slot />
    </>
  )
}
```

**Native navigation**: use `Stack` from `'one'` (wraps React Navigation) instead of `Slot` when on native:

```tsx
import { isWeb } from 'tamagui'
import { Slot, Stack } from 'one'

export function Layout() {
  return isWeb ? (
    <Slot />
  ) : (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="home" />
      <Stack.Screen name="auth" />
    </Stack>
  )
}
```

---

## Data Loading

### loader() + useLoader()

Export an async `loader` function from a page file. Use `useLoader(loader)` in the component to consume it.

```tsx
// app/blog/[slug]+ssr.tsx
import { useLoader } from 'one'

export async function loader({ params }: { params: { slug: string } }) {
  const post = await fetchPost(params.slug)
  return { post }
}

export default function BlogPost() {
  const { post } = useLoader(loader)
  return <article>{post.title}</article>
}
```

`LoaderProps` type (from `'one'`):
```ts
type LoaderProps<Params = Record<string, string | string[]>> = {
  path: string
  search?: string
  params: Params
  request?: Request   // available in SSR/API routes
}
```

### useLoaderState() — loading/refetch state

```tsx
import { useLoaderState } from 'one'

const { data, state, refetch } = useLoaderState(loader)
// state: 'idle' | 'loading'
if (state === 'loading') return <Spinner />
```

### generateStaticParams() — for +ssg routes

Returns array of param objects to pre-render at build time:

```tsx
// app/blog/[slug]+ssg.tsx
export async function generateStaticParams() {
  const posts = await getAllPosts()
  return posts.map(({ slug }) => ({ slug }))
}

export async function loader({ params }: { params: { slug: string } }) {
  return { post: await fetchPost(params.slug) }
}

export default function BlogPost() {
  const { post } = useLoader(loader)
  return <article>{post.title}</article>
}
```

### Typed loaders with createRoute

```tsx
import { createRoute } from 'one'

const route = createRoute<'/blog/[slug]'>()

export const loader = route.createLoader(async ({ params }) => {
  // params.slug is typed as string
  return { post: await fetchPost(params.slug) }
})
```

---

## Navigation & Routing

### Link component

```tsx
import { Link } from 'one'

<Link href="/home/feed">Feed</Link>
<Link href={`/blog/${slug}`}>Post</Link>
```

### Redirect

```tsx
import { Redirect } from 'one'

if (!user) return <Redirect href="/auth/login" />
```

### Hooks

```tsx
import { useRouter, usePathname, useParams, useMatches } from 'one'

const router = useRouter()
router.push('/home')
router.replace('/auth/login')
router.back()

const pathname = usePathname()   // '/blog/my-post'
const params = useParams()       // { slug: 'my-post' }
const matches = useMatches()     // all matched routes with loader data
```

### routes.d.ts — typed routes

OneJS auto-generates `app/routes.d.ts` with all known routes. This gives you type-safe `href` props on `Link` and `router.push()`. Regenerate by running the dev server.

---

## Known issues & workarounds (routing)
These come from One’s integration with React Navigation (`node_modules/one/src/views/Navigator.tsx`, `hooks.tsx`, `RouteInfoContext.tsx`). Behavior may change in future One versions.
### 1. `usePathname()` in layouts vs the real URL
Inside a `_layout.tsx`, `usePathname()` ultimately uses **root navigation state** (`useStoreRouteInfo()`), which can be **incomplete or out of sync** with the address bar during nested navigators’ first paint, refresh, or certain stacks. Leaf pages get more accurate info via `RouteInfoContext`.
**Workaround (shell / guards):** For anything that must match the **browser URL** on web (tab bar visibility, auth redirects keyed to path), read `window.location.pathname` on web (e.g. a small `useResolvedPathname()` helper: web → `window.location.pathname`, native → `usePathname()`). Do not rely on layout `usePathname()` alone for those decisions.
### 2. Late-mount `Slot` + dynamic segments → wrong screen on refresh
When a parent layout **does not render children for a while** (e.g. auth `loading` → `null`), inner **`Slot`** navigators can mount **after** `NavigationContainer` has already consumed **linking `initialState`**. One then tries to infer `initialRouteName` from `initialPathname` / `window.location.pathname` using a **string heuristic** (see `QualifiedNavigator`’s `resolvedInitialRouteName` in `node_modules/one/src/views/Navigator.tsx`).
That heuristic **does not match dynamic file segments** like `[chatId]`: the URL has a real id, not the literal string `[chatId]`, so **no screen matches** → `initialRouteName` is `undefined` → `StackRouter` falls back to the **first sorted child**, often `index` (e.g. refresh on `/home/talks/<uuid>` shows the **talks list** while the URL stays on the chat).

**Workaround (Vine shared helpers):**

| Module | Role |
|--------|------|
| `~/features/app/slot-initial-route.ts` | `getSyncPathnameForSlot()` — web: `window.location.pathname`; native: `expo-linking` `getLinkingURL()` + `parse()`. `matchSlotInitialRouteFromPathname(pathname, basePath, screenNames)` maps URL → screen `name` (`index`, static segments, first `[param]`). `parseDynamicRouteParam(...)` for param fallback on dynamic pages. |
| `~/features/app/useSlotInitialRouteName.ts` | `useSlotInitialRouteName(basePath, screenNames)` — call from the stack `_layout.tsx` that wraps `Slot`. Pass a **stable** `screenNames` array (module-level `const`, same strings as file segments: `index`, `requests`, `[chatId]`, …). |

**Per-stack constants** (public URL prefix + screen list) live **outside** `app/` — e.g. `~/features/chat/talks-config.ts` exporting `TALKS_SLOT_BASE_PATH` and `TALKS_STACK_SCREEN_NAMES`. **Do not** leave config-only `.ts` files inside `app/.../your-stack/` or One may register **`/home/.../talks-config`** as a real route in `routes.d.ts`.

**Extra guard:** `useSlotInitialRouteName` will not choose a dynamic screen unless the pathname yields a **valid** segment (it treats literal `undefined` / `null` path segments as invalid and falls back to `index`), so React Navigation does not serialize URLs like `/home/talks/undefined`.

```tsx
// app/.../talks/_layout.tsx
import { Slot } from 'one'
import { useSlotInitialRouteName } from '~/features/app/useSlotInitialRouteName'
import { TALKS_SLOT_BASE_PATH, TALKS_STACK_SCREEN_NAMES } from '~/features/chat/talks-config'

export default function TalksLayout() {
  const initialRouteName = useSlotInitialRouteName(TALKS_SLOT_BASE_PATH, TALKS_STACK_SCREEN_NAMES)
  return <Slot {...(initialRouteName ? { initialRouteName } : {})} />
}
```

### 3. Forced `initialRouteName` without params → empty `useParams` / blank UI
Supplying only `initialRouteName: '[chatId]'` does **not** restore full linking state; **route params** (e.g. `chatId`) may still be missing. **`useParams()`** then returns no `chatId` even though the URL is correct → conditional `return null` on the page causes a **blank screen**.

**Workaround:** On the dynamic page, prefer **`useParams()`**, then fall back with **`parseDynamicRouteParam(path, basePath, screenNames)`** using the **same** `basePath` and `screenNames` as the stack config. For web, reading `window.location.pathname` for that fallback is fine; native can use `getSyncPathnameForSlot()` or `usePathname()` on a leaf page.

```tsx
// [chatId].tsx — pattern
import { useParams, usePathname } from 'one'
import { useMemo } from 'react'
import { Platform } from 'react-native'
import { getSyncPathnameForSlot, parseDynamicRouteParam } from '~/features/app/slot-initial-route'
import { TALKS_SLOT_BASE_PATH, TALKS_STACK_SCREEN_NAMES } from '~/features/chat/talks-config'

const { chatId: paramChatId } = useParams<{ chatId: string }>()
const pathnameFromNav = usePathname()
const chatId = useMemo(() => {
  if (paramChatId) return paramChatId
  const path =
    Platform.OS === 'web' && typeof window !== 'undefined'
      ? window.location.pathname
      : getSyncPathnameForSlot() || pathnameFromNav
  return parseDynamicRouteParam(path, TALKS_SLOT_BASE_PATH, [...TALKS_STACK_SCREEN_NAMES])
}, [paramChatId, pathnameFromNav])
```

## API Routes

Export HTTP methods from a `+api.ts` file. Use standard `Request` / `Response` objects:

```ts
// app/api/users/[id]+api.ts
export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const user = await getUser(params.id)
  return Response.json(user)
}

export async function POST(request: Request) {
  const body = await request.json()
  const user = await createUser(body)
  return Response.json(user, { status: 201 })
}
```

Typed API routes:
```ts
import { createAPIRoute } from 'one'

export const GET = createAPIRoute<'/api/users/[id]'>((request, { params }) => {
  // params.id is typed
  return Response.json({ id: params.id })
})
```

---

## Middleware

```ts
// app/_middleware.ts
import type { Middleware } from 'one'

const middleware: Middleware = async ({ request, next }) => {
  const response = await next()
  // can inspect/mutate response
  return response
}

export default middleware
```

Middleware runs on the server for all requests in its directory subtree.

---

## Cross-Platform (Web vs Native)

### isWeb / isNative (from tamagui or one)

```tsx
import { isWeb } from 'tamagui'
// or
import { Platform } from 'react-native'
const isWeb = Platform.OS === 'web'

return isWeb ? <WebComponent /> : <NativeComponent />
```

### Platform-specific files

Create `.native.tsx` alongside the base file — OneJS/Metro will pick the right one:

```
HomeLayout.tsx         # used on web / SSR
HomeLayout.native.tsx  # used on iOS / Android
```

### Environment variables

```ts
process.env.VITE_PLATFORM     // 'web' | 'native'
process.env.VITE_ENVIRONMENT  // 'ssr' | 'client' | 'ios' | 'android'
process.env.ONE_SERVER_URL    // server URL for SSG/SSR calls
```

---

## Route Groups

Wrap directory names in `()` to group routes without affecting the URL. Useful for sharing a layout between routes that don't share a URL prefix:

```
app/
  (app)/
    _layout.tsx    # shared layout (auth guard, providers)
    home/
      index.tsx    # URL: /home
    auth/
      login.tsx    # URL: /auth/login
```

---

## Vine's app/web Structure

```
apps/web/app/
  _layout.tsx          # root HTML shell + providers
  _middleware.ts        # error tracking middleware
  index+ssg.tsx         # / → redirects to /auth/login
  hello+spa.tsx         # /hello SPA page
  (app)/
    _layout.tsx        # auth guard + Zero/Toast providers
    auth/
      login.tsx        # /auth/login
      login/password.tsx
      signup/[method].tsx
    home/
      (tabs)/
        _layout.tsx   # tabs header
        feed/index.tsx
      settings/
        index.tsx
        ...
  routes.d.ts          # auto-generated typed routes
```

---

## Common Patterns

**Auth guard in layout:**
```tsx
import { Redirect, Slot, usePathname } from 'one'

export function AppLayout() {
  const { state } = useAuth()
  const pathname = usePathname()

  if (state === 'loading') return null

  if (state === 'logged-out' && pathname.startsWith('/home')) {
    return <Redirect href="/auth/login" />
  }
  if (state === 'logged-in' && pathname.startsWith('/auth')) {
    return <Redirect href="/home/feed" />
  }

  return <Slot />
}
```

**Disable SSR for a subtree:**
```tsx
import { Configuration } from 'one'
// (or your own wrapper)
<Configuration disableSSR>
  <Slot />
</Configuration>
```

**Head / meta tags:**
```tsx
import { Head } from 'one'

export default function Page() {
  return (
    <>
      <Head>
        <title>My Page</title>
        <meta name="description" content="..." />
      </Head>
      <div>content</div>
    </>
  )
}
```
