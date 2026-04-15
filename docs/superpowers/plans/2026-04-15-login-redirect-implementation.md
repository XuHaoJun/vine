# Login Redirect to Original URL Implementation Plan

> **For agentic workers:** Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When unauthenticated users are redirected to login, preserve their original URL and land them there after login — instead of always going to `/home/talks`.

**Architecture:** Save the original pathname to sessionStorage in the auth guard before redirecting to login. The login page already reads from sessionStorage and will redirect correctly after auth. Also add `/manager` to protected route prefixes.

**Tech Stack:** OneJS (useAuth hook, Redirect), vanilla sessionStorage

---

## Task 1: Modify Auth Guard in _layout.tsx

**File:** `apps/web/app/(app)/_layout.tsx`

- [ ] **Step 1: Read current file** — already read at line 1-82

- [ ] **Step 2: Add /manager to protected prefixes**

Old (line 40-42):
```tsx
const isLoggedInRoute =
  pathname.startsWith('/home') || pathname.startsWith('/developers')
if (state === 'logged-out' && isLoggedInRoute) {
  return <Redirect href="/auth/login" />
}
```

New:
```tsx
const isLoggedInRoute =
  pathname.startsWith('/home') ||
  pathname.startsWith('/developers') ||
  pathname.startsWith('/manager')
if (state === 'logged-out' && isLoggedInRoute) {
  if (typeof window !== 'undefined') {
    window.sessionStorage.setItem(LOGIN_REDIRECT_KEY, pathname)
  }
  return <Redirect href="/auth/login" />
}
```

- [ ] **Step 3: Replace hardcoded /home/talks with pendingRedirect**

Old (line 56-58):
```tsx
if (state === 'logged-in' && isGuestOnlyAuthRoute && !hasPendingAuthContinuation) {
  return <Redirect href="/home/talks" />
}
```

New:
```tsx
if (state === 'logged-in' && isGuestOnlyAuthRoute && !hasPendingAuthContinuation) {
  const saved = pendingRedirect ?? '/home/talks'
  return <Redirect href={saved} />
}
```

- [ ] **Step 4: Verify**

Run: `bun run --cwd apps/web test:unit` — no new tests needed, behavior is covered by integration tests

- [ ] **Step 5: Commit**

```bash
git add apps/web/app/\(app\)/_layout.tsx
git commit -m "feat: redirect to original URL after login"
```
