# LINE Login Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rewrite the login page to match LINE's visual design, using Better Auth email/password.

**Architecture:** Two file changes only — a new `LineIcon` SVG component and a full rewrite of `login.tsx`. No server changes. No new packages. No env vars.

**Tech Stack:** `react-native-svg`, `react-hook-form`, `@hookform/resolvers/valibot`, `valibot`, Tamagui layout primitives, Better Auth client.

---

## File Map

| Action | Path | Responsibility |
|--------|------|----------------|
| Create | `apps/web/src/interface/icons/LineIcon.tsx` | LINE speech bubble SVG, same API as GoogleIcon/AppleIcon |
| Rewrite | `apps/web/app/(app)/auth/login.tsx` | LINE-faithful login UI — email + password form, green button, links |

---

## Task 1: LineIcon SVG Component

**Files:**
- Create: `apps/web/src/interface/icons/LineIcon.tsx`

- [ ] **Step 1: Create the component**

```tsx
import Svg, { Path } from 'react-native-svg'

import { useIconProps } from './useIconProps'

import type { IconProps } from '~/interface/icons/types'

export const LineIcon = (props: IconProps) => {
  const { width, height, fill, ...svgProps } = useIconProps(props)

  return (
    <Svg width={width} height={height} viewBox="0 0 24 24" fill="none" {...svgProps}>
      <Path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M19.365 9.863c.349 0 .63.285.63.631 0 .345-.281.63-.63.63H17.61v1.125h1.755c.349 0 .63.283.63.63 0 .344-.281.629-.63.629h-2.386c-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.63-.63h2.386c.346 0 .627.285.627.63 0 .349-.281.63-.63.63H17.61v1.125h1.755zm-3.855 3.016c0 .27-.174.51-.432.596-.064.021-.133.031-.199.031-.211 0-.391-.09-.51-.25l-2.443-3.317v2.94c0 .344-.279.629-.631.629-.346 0-.626-.285-.626-.629V8.108c0-.27.173-.51.43-.595.06-.023.136-.033.194-.033.195 0 .375.104.495.254l2.462 3.33V8.108c0-.345.282-.63.63-.63.345 0 .63.285.63.63v4.771zm-5.741 0c0 .344-.282.629-.631.629-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.63-.63.346 0 .628.285.628.63v4.771zm-2.466.629H4.917c-.345 0-.63-.285-.63-.629V8.108c0-.345.285-.63.63-.63.348 0 .63.285.63.63v4.141h1.756c.348 0 .629.283.629.63 0 .344-.282.629-.629.629M24 10.314C24 4.943 18.615.572 12 .572S0 4.943 0 10.314c0 4.811 4.27 8.842 10.035 9.608.391.082.923.258 1.058.59.12.301.079.766.038 1.08l-.164 1.02c-.045.301-.24 1.186 1.049.645 1.291-.539 6.916-4.078 9.436-6.975C23.176 14.393 24 12.458 24 10.314"
        fill={fill}
      />
    </Svg>
  )
}
```

The `fillRule="evenodd"` makes the LINE letters appear as transparent cutouts inside the bubble. Result: when `fill="#06C755"`, you see a green speech bubble with white letter-shaped holes — the LINE logo mark.

- [ ] **Step 2: Verify it renders**

Run `bun run dev` and navigate to any page that has access to the icon import. Alternatively, temporarily import it in `login.tsx` (next task) and verify visually. No unit test — icon components are excluded per AGENTS.md ("Trivial UI components").

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/interface/icons/LineIcon.tsx
git commit -m "feat: add LineIcon SVG component"
```

---

## Task 2: Rewrite login.tsx

**Files:**
- Rewrite: `apps/web/app/(app)/auth/login.tsx`

**Reference imports that already exist:**
- `passwordLogin` — `~/features/auth/client/passwordLogin` — returns `Promise<{ success: true } | { success: false, error: { code, title, message } }>`
- `signInAsDemo` — `~/features/auth/client/signInAsDemo` — returns `Promise<{ error? }>` 
- `isDemoMode` — `~/helpers/isDemoMode`
- `Input` — `~/interface/forms/Input` — accepts `error?: string`, passes remaining props to `TamaguiInput`
- `Button` — `~/interface/buttons/Button`
- `Link` — `~/interface/app/Link`
- `Pressable` — `~/interface/buttons/Pressable` — styled `View` with pressStyle opacity
- `H2` — `~/interface/text/Headings`
- `showToast` — `~/interface/toast/helpers`

- [ ] **Step 1: Write the full rewrite**

Replace the entire file contents with:

```tsx
import { router } from 'one'
import { useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { valibotResolver } from '@hookform/resolvers/valibot'
import { isWeb, SizableText, Spinner, XStack, YStack } from 'tamagui'
import * as v from 'valibot'

import { passwordLogin } from '~/features/auth/client/passwordLogin'
import { signInAsDemo } from '~/features/auth/client/signInAsDemo'
import { isDemoMode } from '~/helpers/isDemoMode'
import { Link } from '~/interface/app/Link'
import { Button } from '~/interface/buttons/Button'
import { Pressable } from '~/interface/buttons/Pressable'
import { Input } from '~/interface/forms/Input'
import { LineIcon } from '~/interface/icons/LineIcon'
import { H2 } from '~/interface/text/Headings'
import { showToast } from '~/interface/toast/helpers'

const LINE_GREEN = '#06C755'

const schema = v.object({
  email: v.pipe(v.string(), v.nonEmpty('Required'), v.email('Invalid email')),
  password: v.pipe(v.string(), v.nonEmpty('Required')),
})

type FormData = v.InferInput<typeof schema>

export const LoginPage = () => {
  const [showPassword, setShowPassword] = useState(false)
  const [demoLoading, setDemoLoading] = useState(false)

  const {
    control,
    handleSubmit,
    formState: { isSubmitting },
  } = useForm<FormData>({
    resolver: valibotResolver(schema),
    defaultValues: { email: '', password: '' },
  })

  const onSubmit = async (data: FormData) => {
    const result = await passwordLogin(data.email, data.password)
    if (!result.success) {
      showToast(result.error.message, { type: 'error' })
      return
    }
    router.replace('/home/feed')
  }

  return (
    <YStack
      flex={1}
      justify="center"
      items="center"
      bg="$background"
      $platform-web={{ minHeight: '100vh' }}
    >
      <YStack
        width="100%"
        items="center"
        gap="$5"
        p={isWeb ? '$6' : '$4'}
        maxW={isWeb ? 380 : '90%'}
      >
        {/* Logo */}
        <YStack items="center" gap="$3">
          <LineIcon size={56} fill={LINE_GREEN} />
          <H2 text="center">Log in to LINE</H2>
        </YStack>

        {/* Form */}
        <YStack width="100%" gap="$3">
          <Controller
            control={control}
            name="email"
            render={({ field: { onChange, value }, fieldState: { error } }) => (
              <Input
                value={value}
                onChangeText={onChange}
                placeholder="Email"
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                error={error?.message}
              />
            )}
          />

          <XStack width="100%" items="flex-start">
            <YStack flex={1}>
              <Controller
                control={control}
                name="password"
                render={({ field: { onChange, value }, fieldState: { error } }) => (
                  <Input
                    value={value}
                    onChangeText={onChange}
                    placeholder="Password"
                    secureTextEntry={!showPassword}
                    error={error?.message}
                    onSubmitEditing={() => handleSubmit(onSubmit)()}
                  />
                )}
              />
            </YStack>
            <Pressable
              mt={14}
              ml="$2"
              onPress={() => setShowPassword((v) => !v)}
            >
              <SizableText size="$3" color="$color9">
                {showPassword ? 'Hide' : 'Show'}
              </SizableText>
            </Pressable>
          </XStack>

          <Button
            size="$5"
            width="100%"
            disabled={isSubmitting}
            onPress={handleSubmit(onSubmit)}
            bg={LINE_GREEN}
            color="white"
            hoverStyle={{ bg: LINE_GREEN, opacity: 0.9 }}
            pressStyle={{ bg: LINE_GREEN, opacity: 0.7 }}
          >
            {isSubmitting ? <Spinner size="small" color="white" /> : 'Log in'}
          </Button>

          <Button variant="transparent" size="$4" width="100%" disabled>
            <SizableText size="$3" color="$color9">
              Forgot password?
            </SizableText>
          </Button>
        </YStack>

        {/* Demo mode — dev only */}
        {isDemoMode && (
          <Button
            variant="outlined"
            size="$5"
            width="100%"
            disabled={demoLoading}
            onPress={async () => {
              setDemoLoading(true)
              const { error } = await signInAsDemo()
              setDemoLoading(false)
              if (error) {
                showToast('Demo login failed', { type: 'error' })
                return
              }
              router.replace('/home/feed')
            }}
            data-testid="login-as-demo"
          >
            {demoLoading ? <Spinner size="small" /> : 'Login as Demo User'}
          </Button>
        )}

        {/* Create account */}
        <XStack gap="$1" justify="center" flexWrap="wrap">
          <SizableText size="$3" color="$color10">
            Don't have an account?
          </SizableText>
          <Link href="/auth/signup/email" size="$3" color={LINE_GREEN} fontWeight="600">
            Create one
          </Link>
        </XStack>
      </YStack>
    </YStack>
  )
}
```

- [ ] **Step 2: Run the dev server and verify manually**

```bash
bun run dev
```

Open `http://localhost:8081/auth/login` and check:

1. LINE logo (green speech bubble) appears at top, "Log in to LINE" heading below it
2. Email field accepts input, shows inline error "Invalid email" on blur with bad value
3. Password field hides text by default; "Show" button toggles visibility
4. Submitting empty form shows "Required" errors on both fields (no network call)
5. Submitting with valid credentials navigates to `/home/feed`
6. Submitting with wrong password shows error toast from `passwordLogin`
7. "Create one" link navigates to `/auth/signup/email`
8. "Forgot password?" button is disabled (no navigation)
9. Demo button visible only in dev mode (`isDemoMode`)

- [ ] **Step 3: Commit**

```bash
git add apps/web/app/(app)/auth/login.tsx
git commit -m "feat: rewrite login page with LINE-faithful design"
```
