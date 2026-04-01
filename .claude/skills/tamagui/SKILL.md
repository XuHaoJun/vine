---
name: takeout-tamagui
description: Tamagui UI framework guide for this project. Use when working with Tamagui components (Stack, XStack, YStack, Text, Button, Input, etc.), styling with tokens ($color, $size, $space, $radius, $z), themes (light/dark mode), media queries, breakpoints, shorthand properties (p, m, bg, ai, jc), or any UI component work in this codebase. Trigger especially when user mentions tamagui, $token syntax, Stack/YStack/XStack, Theme, useTheme, or asks about spacing/colors in the UI.
---

# Tamagui UI Framework Skill

This project uses Tamagui v2 (tamagui v5 config) in a turborepo monorepo structure:
- `apps/web/` - Main web application
- `packages/ui/` - Future: shared UI components (not yet created)

The `~/interface/` alias points to `apps/web/src/interface/` in the current setup.

## Critical Rules

**You MUST enforce these rules — they will cause errors if violated:**

### Shorthands Only

`onlyAllowShorthands: true` is enabled. Use ONLY these v5 shorthand properties:

| Shorthand | Full Property |
|-----------|---------------|
| `p` | padding |
| `pb`, `pl`, `pr`, `pt`, `px`, `py` | paddingBottom/Left/Right/Top/Horizontal/Vertical |
| `m`, `mb`, `ml`, `mr`, `mt`, `mx`, `my` | margin (same pattern) |
| `bg` | backgroundColor |
| `rounded` | borderRadius |
| `z` | zIndex |
| `b`, `l`, `r`, `t` | bottom, left, right, top |
| `items` | alignItems |
| `justify` | justifyContent |
| `grow` | flexGrow |
| `shrink` | flexShrink |
| `self` | alignSelf |
| `content` | alignContent |
| `maxH`, `maxW`, `minH`, `minW` | maxHeight, maxWidth, minHeight, minWidth |
| `select` | userSelect |
| `text` | textAlign |

**NOT available in v5:** `w` (width), `h` (height), `f` (flex), `zi` (zIndex). Use full property names for these: `width`, `height`, `flex`, `zIndex`.

### Web-First Props (v2 Breaking Changes)

❌ `accessibilityLabel` → ✅ `aria-label`
❌ `accessibilityRole` → ✅ `role`
❌ `focusable` → ✅ `tabIndex`
❌ `onPress` → ✅ `onClick`
❌ `onPressIn` → ✅ `onPointerDown`
❌ `onPressOut` → ✅ `onPointerUp`
❌ `shadowColor`/`shadowOffset`/`shadowOpacity`/`shadowRadius` → ✅ `boxShadow="0 2px 10px $token"`

### Custom Components (use these instead of Tamagui defaults)

When building UI, check `~/interface/` first for custom implementations:

| Component | Path | Usage |
|-----------|------|-------|
| **Button** | `~/interface/buttons/Button` | Primary button with variants: `default`, `outlined`, `transparent`, `floating` |
| **Input** | `~/interface/forms/Input` | Text input |
| **Headings** | `~/interface/text/Headings` | H1-H6 components with heading font |
| **Image** | `~/interface/image/Image` | Web-aligned image |
| **Avatar** | `~/interface/avatars/Avatar` | Avatar component |
| **Dialog** | `~/interface/dialogs/Dialog` | Modal dialog |
| **Toast** | `~/interface/toast/Toast` | Toast notifications |
| **Link** | `~/interface/app/Link` | Link component |
| **ThemeSwitch** | `~/interface/theme/ThemeSwitch` | Dark/light mode toggle |

**Note:** The custom Button uses `boxShadow` (not `shadowColor`/`shadowRadius` props) for shadows.

## Tokens

Design system values use `$` prefix.

### Space Tokens (margin, padding, gap)

| Token | Value |
|-------|-------|
| `$0.25` through `$20` | Positive spacing |
| `$0` | Zero |
| `$-0.25` through `$-20` | Negative spacing |
| `$true` | 18px (fallback) |

Common: `$1`=2px, `$2`=7px, `$3`=13px, `$4`=18px, `$5`=24px, `$6`=32px, `$8`=46px, `$10`=60px

### Size Tokens (width, height)

| Token | Value |
|-------|-------|
| `$0` through `$20` | Size values |
| `$true` | 44px (fallback) |

Common: `$1`=20px, `$2`=28px, `$4`=44px, `$6`=64px, `$8`=84px, `$10`=104px, `$12`=144px

### Radius Tokens

`$0`=0px, `$1`=3px, `$2`=5px, `$4`=9px, `$6`=16px, `$8`=22px (through `$12`)

### Z-Index Tokens

`$0`=0, `$1`=100, `$2`=200, `$3`=300, `$4`=400, `$5`=500

### Color Tokens

Theme colors: `$background`, `$color`, `$borderColor`, `$backgroundHover`, `$colorHover`
Named colors: `$blue1`-`$blue12`, `$gray1`-`$gray12`, etc.
Color scale: `$color0`, `$color02`, `$color04`, `$color06`, `$color08`, `$color1`-`$color12`

## Themes

### Theme Levels
1. **Base:** `dark`, `light`
2. **Color Schemes:** `accent`, `blue`, `green`, `orange`, `pink`, `purple`, `red`, `teal`, `yellow`
3. **Component:** `Button`, `Card`, `Input`, `Checkbox`, `Switch`, `Tooltip`, etc.

### Theme Usage
```tsx
<Theme name="dark">
  <Button>Dark button</Button>
</Theme>

<Theme name="dark">
  <Theme name="blue">
    <Button>dark_blue theme</Button>
  </Theme>
</Theme>

<Theme inverse>   {/* Swap light/dark */}
<Theme reset>     {/* Revert to grandparent */}
```

## Media Queries

### Breakpoints (mobile-first, min-width)
| Breakpoint | Size |
|------------|------|
| `xxxs` | 260px |
| `xxs` | 340px |
| `xs` | 460px |
| `sm` | 640px |
| `md` | 768px |
| `lg` | 1024px |
| `xl` | 1280px |
| `xxl` | 1536px |

### Max-Width Breakpoints (desktop-first)
`max-xxxl`, `max-xxs`, `max-xs`, `max-sm`, `max-md`, `max-lg`, `max-xl`, `max-xxl`

### Height Breakpoints
`height-sm` (640px), `height-md` (768px), `height-lg` (1024px)
`max-height-lg`, `max-height-md`, `max-height-sm`, etc.

### Other
`touchable` - Touch devices (`pointer: coarse`)
`hoverable` - Hover-capable devices (`hover: hover`)

### Usage
```tsx
<Stack width="100%" $md={{ width: "50%" }} $lg={{ width: "33%" }} />

const media = useMedia()
if (media.lg) { /* large screens */ }
```

## Animations

Duration: `0ms`, `30ms`, `50ms`, `75ms`, `100ms`, `200ms`, `300ms`

Named: `quickest`, `quick`, `medium`, `slow`, `slowest`, `lazy`, `superLazy`
Bouncy: `bouncy`, `superBouncy`, `kindaBouncy`, `quickLessBouncy`, etc.

## Components Reference

### Core Layout
`Stack`, `XStack`, `YStack`, `ZStack`, `View`, `ScrollView`, `Spacer`, `Group`

### Typography
`Text`, `Paragraph`, `Heading`, `H1`-`H6`

### Form
`Input`, `TextArea`, `Button`, `Checkbox`, `RadioGroup`, `Switch`, `Slider`, `Label`, `Fieldset`, `Form`

### Display
`Card`, `ListItem`, `Image`, `Avatar`, `Progress`, `Spinner`, `Separator`

### Overlays
`Dialog`, `AlertDialog`, `Popover`, `Tooltip`, `Sheet`, `Overlay`

### Semantic
`Article`, `Aside`, `Footer`, `Header`, `Main`, `Nav`, `Section`

## Default Font

Default font family is `body`. Available: `body`, `heading`, `mono` (JetBrains Mono).

## Package Compatibility

Before installing any npm package, check if it supports React Native:

| Package Type | Action Required |
|--------------|-----------------|
| Pure JS / TypeScript | ✅ Usually works on both |
| Has native code (iOS/Android) | ❌ Do NOT install directly |
| Web-only (DOM APIs) | ⚠️ Use platform detection or fallback |

### Red Flags (web-only, avoid)

- Uses `window`, `document` without guards
- Uses Node.js built-ins (`fs`, `path`, `crypto`)
- Browser-only APIs

### Safe Alternatives

| Web-only | Use Instead |
|----------|-------------|
| `localStorage` | `@react-native-async-storage/async-storage` or `react-native-mmkv` |
| `IntersectionObserver` | `react-native-reanimated` + `useAnimatedReaction` |
| `fetch` (advanced) | `@tanstack/react-query` |

### Platform Detection

```ts
import { isWeb, isNative } from 'tamagui'

if (isWeb) {
  // Web-only code
}
```

---

## Platform-Specific Files

Tamagui uses file extensions for platform-specific code:

| Extension | Platform | Behavior |
|-----------|----------|----------|
| `File.ts` | Shared | Base file, used if no platform-specific version exists |
| `File.native.ts` | Native only | Replaces base file on iOS/Android |
| `File.web.ts` | Web only | Replaces base file on web |
| `File.ios.ts` | iOS only | Replaces base file on iOS only |
| `File.android.ts` | Android only | Replaces base file on Android only |

**Important:** When both `.native.ts` and `.web.ts` exist, the base `.ts` file is **skipped**.

**Examples:**

```
// Both platforms use the same implementation
format.ts

// Native uses special implementation, web uses base
format.ts
format.native.ts

// Each platform has its own version
format.native.ts  // native (iOS + Android)
format.web.ts     // web only
```

## Best Practices

1. Always use shorthands — full property names error out (except `width`, `height`, `flex`, `zIndex`)
2. Prefer `$token` syntax over hardcoded values
3. Mobile-first responsive design with min-width queries
4. Use theme tokens for automatic light/dark mode
5. Check `~/interface/` for custom components before using Tamagui defaults
6. Use semantic HTML components for accessibility
7. Use media query props over conditional rendering
8. Use platform extensions (`.native.ts`, `.web.ts`) instead of runtime platform checks when possible

## Additional Resources

- Tamagui config: `apps/web/src/tamagui/tamagui.config.ts` (extends `@tamagui/config/v5`)
- Animations: `apps/web/src/tamagui/animationsApp.ts`
- Custom components: `apps/web/src/interface/`
- Tamagui v5 source: `/learn-projects/tamagui/code/core/shorthands/src/v5.ts`
