# Login Redirect to Original URL

## Problem

When an unauthenticated user visits a protected route (e.g. `/developers/console`), the auth guard in `_layout.tsx` redirects to `/auth/login` but discards the original URL. After login, the user always lands on `/home/talks` regardless of where they started.

## Scope

- Single file change: `apps/web/app/(app)/_layout.tsx`
- No changes to `login.tsx` — it already reads from sessionStorage

## Design

### Mechanism: sessionStorage

Use the existing `LOGIN_REDIRECT_KEY` (`auth.login.target`) in sessionStorage to pass the original URL from the auth guard to the login page.

### Changes

#### 1. Auth guard — save original URL before redirect

In `_layout.tsx`, before `<Redirect href="/auth/login">`, save `pathname` to sessionStorage:

```tsx
const PROTECTED_PREFIXES = ['/home', '/developers', '/manager']
const isLoggedInRoute = PROTECTED_PREFIXES.some((p) => pathname.startsWith(p))
if (state === 'logged-out' && isLoggedInRoute) {
  if (typeof window !== 'undefined') {
    window.sessionStorage.setItem(LOGIN_REDIRECT_KEY, pathname)
  }
  return <Redirect href="/auth/login" />
}
```

- Add `/manager` to protected prefixes (currently missing)
- Guard with `typeof window` for SSR safety

#### 2. Logged-in redirect — use saved target instead of hardcoded path

Replace hardcoded `/home/talks` with `pendingRedirect` (already computed from sessionStorage):

```tsx
if (state === 'logged-in' && isGuestOnlyAuthRoute && !hasPendingAuthContinuation) {
  const saved = pendingRedirect ?? '/home/talks'
  return <Redirect href={saved} />
}
```

### Flow

```
1. User visits /developers/console (not logged in)
2. _layout.tsx: sessionStorage["auth.login.target"] = "/developers/console"
3. Redirect → /auth/login
4. User logs in
5. login.tsx reads sessionStorage → "/developers/console"
6. window.location.replace("/developers/console")
```

### Future: Per-section Login Buttons

When developers/manager add their own login buttons, they can:
- Set sessionStorage directly before navigating to `/auth/login`
- Or use the existing `?redirect=` param support in `login.tsx`

Both converge in the same `getPostLoginRedirect()` flow.

## Files

| File | Change |
|------|--------|
| `apps/web/app/(app)/_layout.tsx` | Save pathname to sessionStorage, add `/manager` to protected prefixes, use saved redirect |

## Verification

1. Visit `/developers/console` while logged out → should redirect to login → after login, land on `/developers/console`
2. Visit `/home/talks` while logged out → should redirect to login → after login, land on `/home/talks`
3. Visit `/auth/login` directly → should redirect to `/home/talks` (default)
4. OAuth flow (`/auth/login?client_id=...`) → should still work (sessionStorage not set for auth routes)
