# LINE Login Page — Design Spec

**Date:** 2026-04-02  
**Scope:** Rewrite the login page to match LINE's visual design. No external OAuth integration — this is the LINE clone itself.

---

## Overview

Replace the current generic starter-template login page with a LINE-faithful login UI. Authentication remains Better Auth email/password — no social providers, no API keys, no third-party OAuth.

---

## What We're Building

A login page that looks and feels like LINE's actual web login page:
- LINE logo at top
- Email + password form
- Green "Log in" button matching LINE's brand color
- "Forgot password?" and "Create account" links

---

## Layout

```
┌────────────────────────┐
│      [LINE logo]       │  ← LineIcon (speech bubble SVG), green circle
│    Log in to LINE      │  ← H2 heading
│                        │
│  [email@example.com  ] │  ← Input, keyboardType="email-address"
│  [••••••••••••      ] │  ← Input, secureTextEntry, show/hide toggle
│                        │
│  [    Log in    ]      │  ← Button, full width, #06C755 green
│   Forgot password?     │  ← Link stub (no page yet)
│                        │
│  Don't have an account?│
│       Create one       │  ← Link to /auth/signup/email
└────────────────────────┘
```

---

## Files Changed

| File | Action |
|------|--------|
| `apps/web/app/(app)/auth/login.tsx` | Full rewrite |
| `apps/web/src/interface/icons/LineIcon.tsx` | New — LINE speech bubble SVG |

No server changes. No new env vars. No new packages.

---

## Component Details

### `LineIcon.tsx`

SVG component following the existing `GoogleIcon` / `AppleIcon` pattern:

- Uses `react-native-svg` (`Svg`, `Path`)
- Accepts `IconProps`, uses `useIconProps` hook
- LINE speech bubble logo path, rendered in whatever `fill` color the parent provides
- Default size matches other icons

### `login.tsx` (rewrite)

**Form:**
- `react-hook-form` + `valibotResolver` — per AGENTS.md form pattern
- Schema: `email` (valid email, non-empty) + `password` (non-empty)
- Submit calls existing `passwordLogin(email, password)` — returns `{ success, error }`
- On success: `router.replace('/home/feed')`
- On error: `showToast(error, { type: 'error' })`
- `formState.isSubmitting` drives button disabled + spinner

**Styling:**
- LINE green: `#06C755` applied via inline style or Tamagui token on the Log In button
- White background card, centered layout (matches current page structure)
- `LineIcon` in a green circle at top (replaces current `LogoIcon`)
- Password field has a show/hide eye toggle (pressable icon, `useState` for visibility)

**Links:**
- "Forgot password?" — `Link` to `/auth/forgot-password`, page doesn't exist yet (stub)
- "Create one" — `Link` to `/auth/signup/email` (existing page)

**Demo mode:**
- Preserve existing demo login button when `isDemoMode` is true, below the divider area — keeps dev workflow intact

---

## What's Not Included

- QR code login (explicitly out of scope)
- LINE OAuth / social providers (out of scope — this IS LINE)
- Forgot password page (link is a stub)
- Phone number login (email-first per design decision)
- Any server changes

---

## Success Criteria

- Login page visually matches LINE's web login page
- Email + password login works end-to-end
- Form validates inline (email format, empty fields) via `Controller` + Input `error` prop
- "Create account" link navigates correctly
- Existing demo login preserved in dev mode
