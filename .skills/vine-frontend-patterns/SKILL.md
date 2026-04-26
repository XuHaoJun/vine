---
name: vine-frontend-patterns
description: Use when editing frontend code in Vine that touches forms, auth UX, dialogs/toasts, shared `~/interface/*` components, client-side state, or storage. Trigger when the user mentions login or signup forms, `react-hook-form`, `valibot`, `Controller`, `useAuth`, `showToast`, `dialogConfirm`, `Jotai`, `~/interface/*`, or asks how frontend patterns work in `apps/web`.
---

# Vine Frontend Patterns

This skill captures the repo-specific frontend patterns that should load for feature work in `apps/web`.

## Required Cross-References

- For Tamagui layout, spacing, tokens, and RN-first flex behavior, use the `tamagui` skill first
- For OneJS routing and layout/file conventions, use the `one` skill
- For Zero data layer details, use the `zero` skill
- For ConnectRPC details, use the `connect` skill

## Core Rules

- Use `~/interface/*` components instead of raw Tamagui imports
- Use `useAuth()` for auth state, not `useUser()`
- Use `useState` / `useReducer` by default; use Jotai only for the higher-frequency or cross-tree cases called out below
- Use inline field errors for forms; dialogs are for blocking actions or unexpected failures
- Keep auth guards in route layouts, not middleware

## Forms

Use `react-hook-form` with `@hookform/resolvers/valibot` for every real form in this repo.

### Form stack

1. Define a Valibot schema
2. Call `useForm()` with `valibotResolver(schema)`
3. Wire each input with `Controller`
4. Surface validation through the input's `error` prop
5. Use `formState.isSubmitting` for loading and disabled UI

### Form rules

- Do not manage a multi-field form with per-field `useState`
- Do not manually validate in the submit handler when the schema can do it
- Do not pass `control` / `name` directly into the shared `Input`; wrap it with `Controller`
- Use `onSubmitEditing={() => handleSubmit(onSubmit)()}` for keyboard submit on inputs

### Example

```tsx
import * as v from 'valibot'
import { Controller, useForm } from 'react-hook-form'
import { valibotResolver } from '@hookform/resolvers/valibot'

import { Button } from '~/interface/buttons/Button'
import { Input } from '~/interface/forms/Input'

const schema = v.object({
  email: v.pipe(v.string(), v.email('Invalid email'), v.nonEmpty('Required')),
  password: v.pipe(v.string(), v.minLength(1, 'Required')),
})

type FormData = v.InferInput<typeof schema>

const { control, handleSubmit, formState: { isSubmitting } } = useForm<FormData>({
  resolver: valibotResolver(schema),
  defaultValues: { email: '', password: '' },
})

<Controller
  control={control}
  name="email"
  render={({ field: { onChange, value }, fieldState: { error } }) => (
    <Input
      value={value}
      onChangeText={onChange}
      error={error?.message}
      onSubmitEditing={() => handleSubmit(onSubmit)()}
    />
  )}
/>

<Button disabled={isSubmitting} onPress={handleSubmit(onSubmit)}>
  Sign in
</Button>
```

## Auth

### Preferred hook

```ts
import { useAuth } from '~/features/auth/client/authClient'
```

`useAuth()` gives you the session state that frontend flows should branch on:

- `loading`
- `logged-in`
- `logged-out`

Use it for guards and top-level auth decisions. Avoid `useUser()` waterfalls for this.

### Route guards

Put route guards in `app/(app)/_layout.tsx`, not middleware.

```tsx
const { state } = useAuth()

if (state === 'logged-out' && pathname.startsWith('/home')) {
  return <Redirect href="/auth/login" />
}

if (state === 'logged-in' && pathname.startsWith('/auth')) {
  return <Redirect href="/home/feed" />
}
```

### Login flows

- Use `passwordLogin(email, password)` for password auth flows
- Use `signInAsDemo()` for demo login
- Treat normal auth failures as form-level errors, not modal errors
- `authData` is the auth payload to pass into Zero-related wiring

## Toasts And Dialogs

### Use a toast for non-blocking feedback

```tsx
import { showToast } from '~/interface/toast/Toast'

showToast('Saved!', { type: 'success' })
showToast('Something went wrong', { type: 'error' })
```

### Use dialogs for blocking or destructive flows

```tsx
import { dialogConfirm, showError } from '~/interface/dialogs/actions'
```

- Use `dialogConfirm()` for destructive confirmation
- Use `showError()` for unexpected failures
- Do not use dialogs for field validation or normal bad-credentials feedback

## State Management

### Default

Use `useState` or `useReducer` for most component state.

### Reach for Jotai only when the problem actually needs it

| Scenario | Pattern |
| --- | --- |
| High-frequency updates | shared `atom` + `useAtom` |
| Shared state across component boundaries | module-level atoms |
| Derived state | derived atoms with `get` |
| Persistence across pages | atoms with storage/persist helpers |

Avoid introducing Zustand or Redux here.

## Storage

Use `createStorage()` from `@take-out/helpers` for typed app storage.

| Platform | Storage |
| --- | --- |
| Native | MMKV |
| Web | localStorage |
| Zero | IndexedDB on web / SQLite on native |

## Common Mistakes

- Importing raw Tamagui components when a `~/interface/*` component already exists
- Using `useUser()` for auth gating instead of `useAuth()`
- Showing `showError()` for inline login or validation failures
- Using `useState` per field in real forms
- Skipping `Controller` and wiring the shared `Input` incorrectly
- Adding Zustand/Redux when local state or Jotai is enough
- Moving auth guards into middleware instead of layout-level routing

## Reference Files

- `apps/web/src/features/auth/client/authClient.ts`
- `apps/web/src/features/auth/client/passwordLogin.ts`
- `apps/web/src/features/auth/client/signInAsDemo.ts`
- `apps/web/src/interface/forms/Input.tsx`
- `apps/web/src/interface/dialogs/actions.ts`
- `apps/web/src/zero/client.tsx`
