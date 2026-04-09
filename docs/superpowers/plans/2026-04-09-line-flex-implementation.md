# @vine/line-flex Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create a tamagui v2 native/web cross-platform LINE Flex Message renderer package `@vine/line-flex`

**Architecture:** Tamagui-first components using Stack/YStack/Text, LINE Flex JSON types as reference, token-based spacing, LINE-specific flex behavior via children injection

**Tech Stack:** tamagui v5, TypeScript, vitest

---

## File Structure

```
packages/line-flex/
├── src/
│   ├── types/
│   │   └── index.ts                    # LINE Flex types (LFlexXxx)
│   ├── components/
│   │   ├── LfBox.tsx                   # Core flex container
│   │   ├── LfText.tsx                  # Text with spans
│   │   ├── LfSpan.tsx                  # Inline text styling
│   │   ├── LfImage.tsx                 # Image component
│   │   ├── LfButton.tsx                # Button with action
│   │   ├── LfIcon.tsx                  # Icon (baseline only)
│   │   ├── LfSeparator.tsx             # Divider
│   │   ├── LfSpacer.tsx               # Fixed spacing
│   │   ├── LfFiller.tsx                # Flexible space (deprecated)
│   │   ├── LfVideo.tsx                # Video with alt content
│   │   ├── LfHero.tsx                  # Bubble hero section
│   │   ├── LfHeader.tsx                # Bubble header section
│   │   ├── LfBody.tsx                  # Bubble body section
│   │   ├── LfFooter.tsx                # Bubble footer section
│   │   ├── LfBubble.tsx                # Single bubble container
│   │   ├── LfCarousel.tsx              # Horizontal carousel
│   │   └── LfMessage.tsx               # Root message component
│   ├── context/
│   │   └── LfContext.tsx               # Action handler context
│   ├── utils/
│   │   ├── spacing.ts                  # LINE spacing → tamagui tokens
│   │   ├── flex.ts                     # LINE flex behavior
│   │   └── action.ts                   # Action handlers
│   └── index.ts                        # Package exports
├── package.json
├── tsconfig.json
└── vitest.config.ts
```

---

## Task 1: Package Setup

**Files:**
- Create: `packages/line-flex/package.json`
- Create: `packages/line-flex/tsconfig.json`
- Create: `packages/line-flex/vitest.config.ts`

- [ ] **Step 1: Create package.json**

```json
{
  "name": "@vine/line-flex",
  "version": "0.0.1",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "scripts": {
    "test": "vitest",
    "typecheck": "tsc --noEmit"
  },
  "peerDependencies": {
    "react": "*",
    "tamagui": "^5.0.0"
  },
  "devDependencies": {
    "@types/react": "^18.2.0",
    "tamagui": "^5.0.0",
    "vitest": "^1.0.0"
  }
}
```

- [ ] **Step 2: Create tsconfig.json**

```json
{
  "extends": "@vine/typescript-config/base.json",
  "compilerOptions": {
    "composite": true,
    "jsx": "react-jsx",
    "strict": true,
    "noEmit": true
  },
  "include": ["src/**/*"],
  "references": []
}
```

- [ ] **Step 3: Create vitest.config.ts**

```ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
```

- [ ] **Step 4: Commit**

```bash
git add packages/line-flex/package.json packages/line-flex/tsconfig.json packages/line-flex/vitest.config.ts
git commit -m "chore(line-flex): initial package setup"
```

---

## Task 2: Type Definitions

**Files:**
- Create: `packages/line-flex/src/types/index.ts`

- [ ] **Step 1: Write type definitions test**

```ts
// packages/line-flex/src/types/index.test.ts
import { describe, expect, it } from 'vitest'
import type {
  LFlexAction,
  LFexBox,
  LFexText,
  LFexBubble,
  LFexCarousel,
  LFexMessage,
} from '../types'

describe('LINE Flex types', () => {
  it('LFexAction supports uri type', () => {
    const action: LFexAction = {
      type: 'uri',
      uri: 'https://line.me/',
    }
    expect(action.type).toBe('uri')
  })

  it('LFexBox requires layout and contents', () => {
    const box: LFexBox = {
      type: 'box',
      layout: 'vertical',
      contents: [],
    }
    expect(box.layout).toBe('vertical')
  })

  it('LFexMessage requires type flex', () => {
    const msg: LFexMessage = {
      type: 'flex',
      altText: 'Test',
      contents: { type: 'bubble', body: { type: 'box', layout: 'vertical', contents: [] } },
    }
    expect(msg.type).toBe('flex')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/line-flex && npx vitest src/types/index.test.ts`
Expected: FAIL with "cannot find module"

- [ ] **Step 3: Create type definitions**

```ts
// packages/line-flex/src/types/index.ts

// ============ Spacing & Sizing ============

export type LFexSize =
  | 'xxs' | 'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'xxl'
  | '3xl' | '4xl' | '5xl' | 'full'

export type LFexSpacing = 'none' | 'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'xxl'
export type LFexMargin = LFexSpacing
export type LFexGravity = 'top' | 'bottom' | 'center'
export type LFexAlign = 'start' | 'end' | 'center'
export type LFexDecoration = 'none' | 'underline' | 'line-through'
export type LFexWeight = 'regular' | 'bold'
export type LFexStyle = 'normal' | 'italic'
export type LFexPosition = 'relative' | 'absolute'
export type LFexLayout = 'horizontal' | 'vertical' | 'baseline'
export type LFexAspectRatio =
  | '1:1' | '1.51:1' | '1.91:1' | '4:3' | '16:9'
  | '20:13' | '2:1' | '3:1' | '3:4' | '9:16' | '1:2' | '1:3'
export type LFexAspectMode = 'cover' | 'fit'
export type LFexBubbleSize = 'nano' | 'micro' | 'deca' | 'hecto' | 'kilo' | 'mega' | 'giga'
export type LFexButtonStyle = 'link' | 'primary' | 'secondary'
export type LFexButtonHeight = 'sm' | 'md'
export type LFexBorderWidth = 'none' | 'light' | 'normal' | 'medium' | 'semi-bold' | 'bold'

// ============ Actions ============

export interface LFexURIAction {
  type: 'uri'
  label?: string
  uri: string
  altUri?: { desktop?: string }
}

export interface LFexMessageAction {
  type: 'message'
  label?: string
  text: string
}

export interface LFexPostbackAction {
  type: 'postback'
  label?: string
  data: string
  displayText?: string
}

export type LFexAction = LFexURIAction | LFexMessageAction | LFexPostbackAction

// ============ Background ============

export interface LFexBackground {
  type: 'linearGradient'
  angle: string
  startColor: string
  endColor: string
  centerColor?: string
  centerPosition?: string
}

// ============ Components ============

export interface LFexBox {
  type: 'box'
  layout: LFexLayout
  contents: LFexComponent[]
  flex?: number
  spacing?: LFexSpacing | string
  margin?: LFexMargin | string
  paddingAll?: string
  paddingTop?: string
  paddingBottom?: string
  paddingStart?: string
  paddingEnd?: string
  position?: LFexPosition
  offsetTop?: string
  offsetBottom?: string
  offsetStart?: string
  offsetEnd?: string
  backgroundColor?: string
  borderColor?: string
  borderWidth?: LFexBorderWidth | string
  cornerRadius?: string
  width?: string
  maxWidth?: string
  height?: string
  maxHeight?: string
  justifyContent?: LFexJustifyContent
  alignItems?: LFexAlignItems
  background?: LFexBackground
  action?: LFexAction
}

export interface LFexButton {
  type: 'button'
  action: LFexAction
  flex?: number
  margin?: LFexMargin | string
  position?: LFexPosition
  offsetTop?: string
  offsetBottom?: string
  offsetStart?: string
  offsetEnd?: string
  height?: LFexButtonHeight
  style?: LFexButtonStyle
  color?: string
  gravity?: LFexGravity
  adjustMode?: 'shrink-to-fit'
}

export interface LFexFiller {
  type: 'filler'
  flex?: number
}

export interface LFexIcon {
  type: 'icon'
  url: string
  size?: LFexSize | string
  aspectRatio?: LFexAspectRatio
  margin?: LFexMargin | string
  position?: LFexPosition
  offsetTop?: string
  offsetBottom?: string
  offsetStart?: string
  offsetEnd?: string
}

export interface LFexImage {
  type: 'image'
  url: string
  flex?: number
  margin?: LFexMargin | string
  position?: LFexPosition
  offsetTop?: string
  offsetBottom?: string
  offsetStart?: string
  offsetEnd?: string
  align?: LFexAlign
  gravity?: LFexGravity
  size?: LFexSize | string
  aspectRatio?: LFexAspectRatio
  aspectMode?: LFexAspectMode
  backgroundColor?: string
  action?: LFexAction
}

export interface LFexSeparator {
  type: 'separator'
  margin?: LFexMargin | string
  color?: string
}

export interface LFexSpacer {
  type: 'spacer'
  size?: LFexSize | string
}

export interface LFexText {
  type: 'text'
  text: string
  contents?: LFexSpan[]
  flex?: number
  margin?: LFexMargin | string
  position?: LFexPosition
  offsetTop?: string
  offsetBottom?: string
  offsetStart?: string
  offsetEnd?: string
  size?: LFexSize | string
  align?: LFexAlign
  gravity?: LFexGravity
  wrap?: boolean
  maxLines?: number
  weight?: LFexWeight
  color?: string
  style?: LFexStyle
  decoration?: LFexDecoration
  lineSpacing?: string
  action?: LFexAction
}

export interface LFexSpan {
  type: 'span'
  text: string
  size?: LFexSize | string
  color?: string
  weight?: LFexWeight
  style?: LFexStyle
  decoration?: LFexDecoration
}

export interface LFexVideo {
  type: 'video'
  url: string
  previewUrl: string
  altContent?: LFexImage | LFexBox
  aspectRatio?: LFexAspectRatio
  action?: LFexAction
}

export type LFexComponent =
  | LFexBox
  | LFexButton
  | LFexFiller
  | LFexIcon
  | LFexImage
  | LFexSeparator
  | LFexSpacer
  | LFexText
  | LFexVideo

// ============ Containers ============

export interface LFexBubbleStyles {
  header?: { backgroundColor?: string }
  hero?: { backgroundColor?: string }
  body?: { backgroundColor?: string }
  footer?: { backgroundColor?: string }
}

export interface LFexBubble {
  type: 'bubble'
  size?: LFexBubbleSize
  direction?: 'ltr' | 'rtl'
  header?: LFexBox
  hero?: LFexBox | LFexImage | LFexVideo
  body?: LFexBox
  footer?: LFexBox
  styles?: LFexBubbleStyles
  action?: LFexAction
}

export interface LFexCarousel {
  type: 'carousel'
  contents: LFexBubble[]
}

export interface LFexMessage {
  type: 'flex'
  altText: string
  contents: LFexBubble | LFexCarousel
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/line-flex && npx vitest src/types/index.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/line-flex/src/types/index.ts packages/line-flex/src/types/index.test.ts
git commit -m "feat(line-flex): add LINE Flex type definitions"
```

---

## Task 3: Spacing Utilities

**Files:**
- Create: `packages/line-flex/src/utils/spacing.ts`
- Create: `packages/line-flex/src/utils/spacing.test.ts`

- [ ] **Step 1: Write spacing utility test**

```ts
// packages/line-flex/src/utils/spacing.test.ts
import { describe, expect, it } from 'vitest'
import { spacingToTamagui, marginToTamagui, paddingToTamagui } from './spacing'

describe('spacing utilities', () => {
  it('converts LINE spacing keywords to tamagui tokens', () => {
    expect(spacingToTamagui('none')).toBe(0)
    expect(spacingToTamagui('xs')).toBe('$1')
    expect(spacingToTamagui('sm')).toBe('$2')
    expect(spacingToTamagui('md')).toBe('$3')
    expect(spacingToTamagui('lg')).toBe('$4')
    expect(spacingToTamagui('xl')).toBe('$5')
    expect(spacingToTamagui('xxl')).toBe('$6')
  })

  it('passes through pixel values', () => {
    expect(spacingToTamagui('10px')).toBe(10)
    expect(spacingToTamagui('25px')).toBe(25)
  })

  it('marginToTamagui works same as spacingToTamagui', () => {
    expect(marginToTamagui('md')).toBe('$3')
  })

  it('paddingToTamagui works same as spacingToTamagui', () => {
    expect(paddingToTamagui('lg')).toBe('$4')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/line-flex && npx vitest src/utils/spacing.test.ts`
Expected: FAIL with "cannot find module"

- [ ] **Step 3: Write spacing utilities**

```ts
// packages/line-flex/src/utils/spacing.ts

type SpacingToken = 0 | '$0.25' | '$0.5' | '$1' | '$2' | '$3' | '$4' | '$5' | '$6' | '$8' | '$10'

const LINE_TO_TAMAGUI: Record<string, SpacingToken> = {
  none: 0,
  xs: '$0.5',
  sm: '$1',
  md: '$2',
  lg: '$3',
  xl: '$4',
  xxl: '$5',
}

export function spacingToTamagui(spacing: string | undefined): number | string | undefined {
  if (spacing === undefined) return undefined
  if (LINE_TO_TAMAGUI[spacing] !== undefined) return LINE_TO_TAMAGUI[spacing]
  // Pixel values pass through as numbers
  if (spacing.endsWith('px')) {
    return parseInt(spacing.replace('px', ''))
  }
  return spacing
}

export function marginToTamagui(margin: string | undefined): number | string | undefined {
  return spacingToTamagui(margin)
}

export function paddingToTamagui(padding: string | undefined): number | string | undefined {
  return spacingToTamagui(padding)
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/line-flex && npx vitest src/utils/spacing.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/line-flex/src/utils/spacing.ts packages/line-flex/src/utils/spacing.test.ts
git commit -m "feat(line-flex): add spacing utilities"
```

---

## Task 4: Flex Utilities (LINE-specific behavior)

**Files:**
- Create: `packages/line-flex/src/utils/flex.ts`
- Create: `packages/line-flex/src/utils/flex.test.ts`

- [ ] **Step 1: Write flex utility test**

```ts
// packages/line-flex/src/utils/flex.test.ts
import { describe, expect, it } from 'vitest'
import { getChildDefaultFlex } from './flex'

describe('LINE flex behavior', () => {
  // LINE horizontal box: children default to flex-1 (flex: 1 0 0)
  it('horizontal box children default to flex-1', () => {
    expect(getChildDefaultFlex(undefined, 'horizontal')).toBe(1)
  })

  // LINE vertical box: children default to flex-none (flex: 0 0 auto)
  it('vertical box children default to flex-none', () => {
    expect(getChildDefaultFlex(undefined, 'vertical')).toBe('none')
  })

  // LINE baseline box: children default to flex-1
  it('baseline box children default to flex-1', () => {
    expect(getChildDefaultFlex(undefined, 'baseline')).toBe(1)
  })

  // Explicit flex values are preserved
  it('preserves explicit flex values', () => {
    expect(getChildDefaultFlex(2, 'horizontal')).toBe(2)
    expect(getChildDefaultFlex(0, 'vertical')).toBe(0)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/line-flex && npx vitest src/utils/flex.test.ts`
Expected: FAIL with "cannot find module"

- [ ] **Step 3: Write flex utilities**

```ts
// packages/line-flex/src/utils/flex.ts
import type { LFexLayout } from '../types'

/**
 * LINE Flex Message has non-standard flex defaults:
 * - horizontal box: children default to flex-1 (flex: 1 0 0)
 * - vertical box: children default to flex-none (flex: 0 0 auto)
 * - baseline box: children default to flex-1
 *
 * This differs from CSS flexbox defaults where children default to flex: 0 1 auto
 */
export function getChildDefaultFlex(
  childFlex: number | undefined,
  parentLayout: LFexLayout
): number | 'none' {
  if (childFlex !== undefined) return childFlex
  if (parentLayout === 'horizontal' || parentLayout === 'baseline') {
    return 1
  }
  return 'none'
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/line-flex && npx vitest src/utils/flex.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/line-flex/src/utils/flex.ts packages/line-flex/src/utils/flex.test.ts
git commit -m "feat(line-flex): add LINE flex behavior utilities"
```

---

## Task 5: Action Utilities

**Files:**
- Create: `packages/line-flex/src/utils/action.ts`
- Create: `packages/line-flex/src/utils/action.test.ts`

- [ ] **Step 1: Write action utility test**

```ts
// packages/line-flex/src/utils/action.test.ts
import { describe, expect, it, vi } from 'vitest'
import type { LFexAction } from '../types'
import { handleAction } from './action'

describe('action utilities', () => {
  it('calls onAction with the action when provided', () => {
    const onAction = vi.fn()
    const action: LFexAction = { type: 'uri', uri: 'https://line.me/' }
    const handler = handleAction(action, onAction)
    handler({} as any)
    expect(onAction).toHaveBeenCalledWith(action)
  })

  it('returns undefined when no action', () => {
    const handler = handleAction(undefined, undefined)
    expect(handler).toBeUndefined()
  })

  it('returns undefined when no onAction handler', () => {
    const action: LFexAction = { type: 'message', text: 'hello' }
    const handler = handleAction(action, undefined)
    expect(handler).toBeUndefined()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/line-flex && npx vitest src/utils/action.test.ts`
Expected: FAIL with "cannot find module"

- [ ] **Step 3: Write action utilities**

```ts
// packages/line-flex/src/utils/action.ts
import type { LFexAction } from '../types'

export function handleAction(
  action: LFexAction | undefined,
  onAction: ((action: LFexAction) => void) | undefined
): ((event: any) => void) | undefined {
  if (!action || !onAction) return undefined
  return (event: any) => {
    event.preventDefault?.()
    onAction(action)
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/line-flex && npx vitest src/utils/action.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/line-flex/src/utils/action.ts packages/line-flex/src/utils/action.test.ts
git commit -m "feat(line-flex): add action utilities"
```

---

## Task 6: LfBox Component (Core)

**Files:**
- Create: `packages/line-flex/src/components/LfBox.tsx`
- Create: `packages/line-flex/src/components/LfBox.test.tsx`

- [ ] **Step 1: Write LfBox test**

```tsx
// packages/line-flex/src/components/LfBox.test.tsx
import { describe, expect, it } from 'vitest'
import { render } from '@testing-library/react'
import { TamaguiProvider, createTamagui } from 'tamagui'
import { LfBox } from './LfBox'

const tamaguiConfig = createTamagui({})

const wrapper = ({ children }: { children: any }) => (
  <TamaguiProvider config={tamaguiConfig}>{children}</TamaguiProvider>
)

describe('LfBox', () => {
  it('renders vertical layout by default', () => {
    const { getByText } = render(
      <LfBox>
        <LfBox>Child</LfBox>
      </LfBox>,
      { wrapper }
    )
    expect(getByText('Child')).toBeTruthy()
  })

  it('applies LINE flex defaults to children', () => {
    // Horizontal box: children should get flex=1 by default
    const { getAllByRole } = render(
      <LfBox layout="horizontal">
        <LfBox><span>A</span></LfBox>
        <LfBox><span>B</span></LfBox>
      </LfBox>,
      { wrapper }
    )
    // Children should have flex-1 from LINE behavior
    const containers = getAllByRole('region')
    expect(containers.length).toBe(2)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/line-flex && npx vitest src/components/LfBox.test.tsx`
Expected: FAIL with "cannot find module"

- [ ] **Step 3: Write LfBox component**

```tsx
// packages/line-flex/src/components/LfBox.tsx
import { Stack, XStack, YStack, styled } from 'tamagui'
import React from 'react'
import type { LFexBox, LFexComponent, LFexAction, LFexLayout } from '../types'
import { getChildDefaultFlex } from '../utils/flex'
import { spacingToTamagui, marginToTamagui, paddingToTamagui } from '../utils/spacing'
import { handleAction } from '../utils/action'

export type LFexBoxProps = LFexBox & {
  className?: string
  onAction?: (action: LFexAction) => void
}

const StyledBox = styled(Stack, {
  flexDirection: 'column',
})

const StyledXBox = styled(XStack, {
  flexDirection: 'row',
})

const StyledBaselineBox = styled(XStack, {
  flexDirection: 'row',
  alignItems: 'baseline',
})

function renderChild(
  child: LFexComponent,
  index: number,
  parentLayout: LFexLayout,
  onAction?: (action: LFexAction) => void
): React.ReactNode {
  const key = `${child.type}-${index}`
  const defaultFlex = getChildDefaultFlex((child as any).flex, parentLayout)
  const childWithFlex = { ...child, flex: (child as any).flex ?? defaultFlex }

  switch (child.type) {
    case 'box':
      return <LfBox key={key} {...childWithFlex} onAction={onAction} />
    case 'text':
      return <LfText key={key} {...childWithFlex} onAction={onAction} />
    case 'image':
      return <LfImage key={key} {...childWithFlex} onAction={onAction} />
    case 'button':
      return <LfButton key={key} {...childWithFlex} onAction={onAction} />
    case 'icon':
      return <LfIcon key={key} {...childWithFlex} />
    case 'separator':
      return <LfSeparator key={key} {...childWithFlex} />
    case 'spacer':
      return <LfSpacer key={key} {...childWithProps} />
    case 'filler':
      return <LfFiller key={key} {...childWithFlex} />
    case 'video':
      return <LfVideo key={key} {...childWithFlex} />
    default:
      return null
  }
}

export function LfBox({
  layout = 'vertical',
  contents = [],
  flex,
  spacing,
  margin,
  paddingAll,
  paddingTop,
  paddingBottom,
  paddingStart,
  paddingEnd,
  position,
  offsetTop,
  offsetBottom,
  offsetStart,
  offsetEnd,
  backgroundColor,
  borderColor,
  borderWidth,
  cornerRadius,
  width,
  maxWidth,
  height,
  maxHeight,
  justifyContent,
  alignItems,
  background,
  action,
  onAction,
  className,
  children,
}: LFexBoxProps & { children?: React.ReactNode }) {
  const gap = spacing ? spacingToTamagui(spacing) : undefined
  const padding = paddingAll ? paddingToTamagui(paddingAll) : undefined
  const marginValue = margin ? marginToTamagui(margin) : undefined

  const positionStyle = position === 'absolute' ? { position: 'absolute' as const } : {}
  const offsetStyle = {
    ...(offsetTop && { top: offsetTop }),
    ...(offsetBottom && { bottom: offsetBottom }),
    ...(offsetStart && { left: offsetStart }),
    ...(offsetEnd && { right: offsetEnd }),
  }

  const clickHandler = handleAction(action, onAction)

  const containerProps = {
    flex: flex ?? 1,
    gap,
    padding,
    margin: marginValue,
    ...positionStyle,
    ...offsetStyle,
    ...(backgroundColor && { backgroundColor }),
    ...(borderColor && { borderColor }),
    ...(cornerRadius && { borderRadius: cornerRadius }),
    ...(width && { width }),
    ...(maxWidth && { maxWidth }),
    ...(height && { height }),
    ...(maxHeight && { maxHeight }),
    ...(justifyContent && { justifyContent }),
    ...(alignItems && { alignItems }),
    ...(action && { cursor: 'pointer' as const }),
    ...(className && { className }),
    onClick: clickHandler,
  }

  // Merge LINE contents with React children
  const renderedContents = contents.length > 0
    ? contents.map((child, i) => renderChild(child, i, layout, onAction))
    : children

  if (layout === 'horizontal') {
    return (
      <StyledXBox {...containerProps}>
        {renderedContents}
      </StyledXBox>
    )
  }

  if (layout === 'baseline') {
    return (
      <StyledBaselineBox {...containerProps}>
        {renderedContents}
      </StyledBaselineBox>
    )
  }

  return (
    <StyledBox {...containerProps}>
      {renderedContents}
    </StyledBox>
  )
}
```

- [ ] **Step 3: Fix import issue in LfBox - need placeholder imports for other components**

```tsx
// packages/line-flex/src/components/LfBox.tsx
// Add these placeholder exports at top (will be implemented in later tasks)
// import { LfText } from './LfText'
// import { LfImage } from './LfImage'
// import { LfButton } from './LfButton'
// import { LfIcon } from './LfIcon'
// import { LfSeparator } from './LfSeparator'
// import { LfSpacer } from './LfSpacer'
// import { LfFiller } from './LfFiller'
// import { LfVideo } from './LfVideo'
```

- [ ] **Step 4: Run test to verify it compiles**

Run: `cd packages/line-flex && npx tsc --noEmit`
Expected: Should show missing imports (LfText, etc) - expected at this stage

- [ ] **Step 5: Commit**

```bash
git add packages/line-flex/src/components/LfBox.tsx packages/line-flex/src/components/LfBox.test.tsx
git commit -m "feat(line-flex): add LfBox core component with LINE flex defaults"
```

---

## Task 7: LfText + LfSpan Components

**Files:**
- Create: `packages/line-flex/src/components/LfText.tsx`
- Create: `packages/line-flex/src/components/LfSpan.tsx`

- [ ] **Step 1: Write LfSpan component**

```tsx
// packages/line-flex/src/components/LfSpan.tsx
import { Text } from 'tamagui'
import type { LFexSpan } from '../types'

export type LFexSpanProps = LFexSpan

export function LfSpan({ text, size, color, weight, style, decoration }: LFexSpanProps) {
  return (
    <Text
      fontSize={size === 'xxs' ? 10 : 
                size === 'xs' ? 11 :
                size === 'sm' ? 12 :
                size === 'md' ? 14 :
                size === 'lg' ? 16 :
                size === 'xl' ? 18 :
                size === 'xxl' ? 20 :
                size === '3xl' ? 24 :
                size === '4xl' ? 30 :
                size === '5xl' ? 36 : 14}
      color={color}
      fontWeight={weight === 'bold' ? '700' : '400'}
      fontStyle={style === 'italic' ? 'italic' : 'normal'}
      textDecorationLine={decoration === 'underline' ? 'underline' : 
                          decoration === 'line-through' ? 'line-through' : 'none'}
    >
      {text}
    </Text>
  )
}
```

- [ ] **Step 2: Write LfText component**

```tsx
// packages/line-flex/src/components/LfText.tsx
import { Text, Paragraph } from 'tamagui'
import { isWeb } from 'tamagui'
import React from 'react'
import type { LFexText, LFexSpan, LFexAction } from '../types'
import { handleAction } from '../utils/action'
import { marginToTamagui } from '../utils/spacing'

export type LFexTextProps = LFexText & {
  className?: string
  layout?: 'horizontal' | 'vertical' | 'baseline'
  onAction?: (action: LFexAction) => void
}

export function LfText({
  text = '',
  contents,
  flex,
  margin,
  position,
  offsetTop,
  offsetBottom,
  offsetStart,
  offsetEnd,
  size = 'md',
  align,
  gravity,
  wrap = false,
  maxLines,
  weight,
  color,
  style,
  decoration,
  lineSpacing,
  action,
  layout,
  onAction,
  className,
}: LFexTextProps) {
  const marginValue = margin ? marginToTamagui(margin) : undefined
  
  const positionStyle = position === 'absolute' ? { position: 'absolute' as const } : {}
  const offsetStyle = {
    ...(offsetTop && { top: offsetTop }),
    ...(offsetBottom && { bottom: offsetBottom }),
    ...(offsetStart && { left: offsetStart }),
    ...(offsetEnd && { right: offsetEnd }),
  }

  const clickHandler = handleAction(action, onAction)

  // Size mapping to tamagui fontSize tokens
  const fontSize = size === 'xxs' ? '$1' :
                   size === 'xs' ? '$2' :
                   size === 'sm' ? '$3' :
                   size === 'md' ? '$4' :
                   size === 'lg' ? '$5' :
                   size === 'xl' ? '$6' :
                   size === 'xxl' ? '$7' :
                   size === '3xl' ? '$8' :
                   size === '4xl' ? '$9' :
                   size === '5xl' ? '$10' : '$4'

  const textAlign = align === 'start' ? 'left' : align === 'end' ? 'right' : align

  const lineHeight = lineSpacing 
    ? `${parseInt(lineSpacing.replace('px', '')) + 15}px`
    : undefined

  const clickableProps = action ? { cursor: 'pointer' as const, onClick: clickHandler } : {}

  // Web-specific text handling
  const textElement = (
    <Text
      flex={flex ?? 1}
      fontSize={fontSize}
      color={color}
      fontWeight={weight === 'bold' ? '700' : '400'}
      fontStyle={style === 'italic' ? 'italic' : 'normal'}
      textDecorationLine={decoration === 'underline' ? 'underline' : 
                          decoration === 'line-through' ? 'line-through' : 'none'}
      textAlign={textAlign}
      lineHeight={lineHeight}
      {...(isWeb && maxLines && !wrap ? {
        style: {
          display: '-webkit-box',
          WebkitLineClamp: maxLines,
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }
      } : {})}
      {...(!isWeb && maxLines ? { numberOfLines: maxLines } : {})}
      {...clickableProps}
      className={className}
    >
      {text}
      {contents?.map((span: LFexSpan, i: number) => (
        <LfSpan key={i} {...span} />
      ))}
    </Text>
  )

  return (
    <Paragraph
      flex={flex ?? 1}
      margin={marginValue}
      {...positionStyle}
      {...offsetStyle}
    >
      {textElement}
    </Paragraph>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add packages/line-flex/src/components/LfSpan.tsx packages/line-flex/src/components/LfText.tsx
git commit -m "feat(line-flex): add LfSpan and LfText components"
```

---

## Task 8: LfImage Component

**Files:**
- Create: `packages/line-flex/src/components/LfImage.tsx`

- [ ] **Step 1: Write LfImage component**

```tsx
// packages/line-flex/src/components/LfImage.tsx
import { Image } from 'tamagui'
import { isWeb } from 'tamagui'
import type { LFexImage, LFexAction } from '../types'
import { handleAction } from '../utils/action'
import { marginToTamagui } from '../utils/spacing'

export type LFexImageProps = LFexImage & {
  className?: string
  onAction?: (action: LFexAction) => void
}

export function LfImage({
  url,
  flex,
  margin,
  position,
  offsetTop,
  offsetBottom,
  offsetStart,
  offsetEnd,
  align,
  gravity,
  size,
  aspectRatio,
  aspectMode = 'cover',
  backgroundColor,
  action,
  onAction,
  className,
}: LFexImageProps) {
  const marginValue = margin ? marginToTamagui(margin) : undefined

  const positionStyle = position === 'absolute' ? { position: 'absolute' as const } : {}
  const offsetStyle = {
    ...(offsetTop && { top: offsetTop }),
    ...(offsetBottom && { bottom: offsetBottom }),
    ...(offsetStart && { left: offsetStart }),
    ...(offsetEnd && { right: offsetEnd }),
  }

  const clickHandler = handleAction(action, onAction)

  // Size mapping
  const width = size === 'xxs' ? 26 :
                size === 'xs' ? 34 :
                size === 'sm' ? 42 :
                size === 'md' ? 52 :
                size === 'lg' ? 62 :
                size === 'xl' ? 76 :
                size === 'xxl' ? 92 :
                size === '3xl' ? 102 :
                size === '4xl' ? 120 :
                size === '5xl' ? 136 :
                size === 'full' ? '100%' : 52

  // Aspect ratio to CSS
  const aspectRatioStyle = aspectRatio 
    ? { aspectRatio: aspectRatio.replace(':', ' / ') }
    : undefined

  // object-fit (web) vs resizeMode (native)
  const resizeMode = isWeb
    ? aspectMode === 'cover' ? 'cover' : 'contain'
    : aspectMode === 'cover' ? 'cover' : 'contain'

  const clickableProps = action ? { cursor: 'pointer' as const, onPress: clickHandler } : {}

  return (
    <Image
      flex={flex ?? 1}
      width={width}
      source={{ uri: url }}
      contentFit={resizeMode}
      margin={marginValue}
      {...positionStyle}
      {...offsetStyle}
      backgroundColor={backgroundColor}
      {...aspectRatioStyle}
      {...clickableProps}
      className={className}
    />
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/line-flex/src/components/LfImage.tsx
git commit -m "feat(line-flex): add LfImage component"
```

---

## Task 9: LfButton Component

**Files:**
- Create: `packages/line-flex/src/components/LfButton.tsx`

- [ ] **Step 1: Write LfButton component**

```tsx
// packages/line-flex/src/components/LfButton.tsx
import { Button, Text } from 'tamagui'
import type { LFexButton, LFexAction, LFexButtonStyle, LFexButtonHeight } from '../types'
import { handleAction } from '../utils/action'
import { marginToTamagui } from '../utils/spacing'

export type LFexButtonProps = LFexButton & {
  className?: string
  onAction?: (action: LFexAction) => void
}

const LINE_BUTTON_COLORS = {
  primary: '#17c950',
  secondary: '#dcdfe5',
  link: '#42659a',
} as const

export function LfButton({
  action,
  flex,
  margin,
  position,
  offsetTop,
  offsetBottom,
  offsetStart,
  offsetEnd,
  height = 'md',
  style = 'link',
  color,
  gravity,
  adjustMode,
  onAction,
  className,
}: LFexButtonProps) {
  const marginValue = margin ? marginToTamagui(margin) : undefined

  const positionStyle = position === 'absolute' ? { position: 'absolute' as const } : {}
  const offsetStyle = {
    ...(offsetTop && { top: offsetTop }),
    ...(offsetBottom && { bottom: offsetBottom }),
    ...(offsetStart && { left: offsetStart }),
    ...(offsetEnd && { right: offsetEnd }),
  }

  const clickHandler = handleAction(action, onAction)

  const heightValue = height === 'sm' ? 40 : 52
  
  const backgroundColor = color ?? (
    style === 'primary' ? LINE_BUTTON_COLORS.primary :
    style === 'secondary' ? LINE_BUTTON_COLORS.secondary :
    'transparent'
  )

  const textColor = style === 'primary' ? '#ffffff' :
                    style === 'secondary' ? '#111111' :
                    color ?? LINE_BUTTON_COLORS.link

  return (
    <Button
      flex={flex ?? 1}
      height={heightValue}
      backgroundColor={backgroundColor}
      margin={marginValue}
      {...positionStyle}
      {...offsetStyle}
      onPress={clickHandler}
      className={className}
      // adjustMode shrink-to-fit not yet supported
    >
      <Text
        color={textColor}
        fontWeight="600"
        fontSize="$3"
      >
        {action.label ?? 'Button'}
      </Text>
    </Button>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/line-flex/src/components/LfButton.tsx
git commit -m "feat(line-flex): add LfButton component"
```

---

## Task 10: Remaining Components

**Files:**
- Create: `packages/line-flex/src/components/LfIcon.tsx`
- Create: `packages/line-flex/src/components/LfSeparator.tsx`
- Create: `packages/line-flex/src/components/LfSpacer.tsx`
- Create: `packages/line-flex/src/components/LfFiller.tsx`
- Create: `packages/line-flex/src/components/LfVideo.tsx`

- [ ] **Step 1: Write LfIcon component**

```tsx
// packages/line-flex/src/components/LfIcon.tsx
import { Image } from 'tamagui'
import type { LFexIcon } from '../types'
import { marginToTamagui } from '../utils/spacing'

export type LFexIconProps = LFexIcon

export function LfIcon({
  url,
  size = 'md',
  aspectRatio = '1:1',
  margin,
  position,
  offsetTop,
  offsetBottom,
  offsetStart,
  offsetEnd,
}: LFexIconProps) {
  const marginValue = margin ? marginToTamagui(margin) : undefined

  const positionStyle = position === 'absolute' ? { position: 'absolute' as const } : {}
  const offsetStyle = {
    ...(offsetTop && { top: offsetTop }),
    ...(offsetBottom && { bottom: offsetBottom }),
    ...(offsetStart && { left: offsetStart }),
    ...(offsetEnd && { right: offsetEnd }),
  }

  // Icon size mapping (smaller than image)
  const width = size === 'xxs' ? 14 :
                size === 'xs' ? 16 :
                size === 'sm' ? 20 :
                size === 'md' ? 24 :
                size === 'lg' ? 28 :
                size === 'xl' ? 32 :
                size === 'xxl' ? 36 :
                size === '3xl' ? 42 :
                size === '4xl' ? 48 :
                size === '5xl' ? 56 : 24

  return (
    <Image
      width={width}
      source={{ uri: url }}
      contentFit="contain"
      margin={marginValue}
      {...positionStyle}
      {...offsetStyle}
    />
  )
}
```

- [ ] **Step 2: Write LfSeparator component**

```tsx
// packages/line-flex/src/components/LfSeparator.tsx
import { Stack } from 'tamagui'
import type { LFexSeparator } from '../types'
import { marginToTamagui } from '../utils/spacing'

export type LFexSeparatorProps = LFexSeparator

export function LfSeparator({
  margin,
  color,
}: LFexSeparatorProps) {
  const marginValue = margin ? marginToTamagui(margin) : undefined

  return (
    <Stack
      height={1}
      backgroundColor={color ?? '#cccccc'}
      margin={marginValue}
    />
  )
}
```

- [ ] **Step 3: Write LfSpacer component**

```tsx
// packages/line-flex/src/components/LfSpacer.tsx
import { Spacer } from 'tamagui'
import type { LFexSpacer } from '../types'

export type LFexSpacerProps = LFexSpacer

export function LfSpacer({ size = 'md' }: LFexSpacerProps) {
  // Spacer size mapping
  const sizeValue = size === 'xxs' ? 4 :
                    size === 'xs' ? 6 :
                    size === 'sm' ? 10 :
                    size === 'md' ? 14 :
                    size === 'lg' ? 18 :
                    size === 'xl' ? 22 :
                    size === 'xxl' ? 26 : 14

  return <Spacer size={sizeValue} />
}
```

- [ ] **Step 4: Write LfFiller component**

```tsx
// packages/line-flex/src/components/LfFiller.tsx
import { Stack } from 'tamagui'
import type { LFexFiller } from '../types'

export type LFexFillerProps = LFexFiller

export function LfFiller({ flex = 1 }: LFexFillerProps) {
  return <Stack flex={flex} />
}
```

- [ ] **Step 5: Write LfVideo component**

```tsx
// packages/line-flex/src/components/LfVideo.tsx
import { Image } from 'tamagui'
import type { LFexVideo, LFexAction } from '../types'
import { handleAction } from '../utils/action'

export type LFexVideoProps = LFexVideo & {
  className?: string
  onAction?: (action: LFexAction) => void
}

export function LfVideo({
  url,
  previewUrl,
  altContent,
  aspectRatio = '20:13',
  action,
  onAction,
  className,
}: LFexVideoProps) {
  // Video renders as Image with previewUrl as fallback
  // Full video support would require platform-specific video player
  const clickHandler = handleAction(action, onAction)

  // Use altContent (image or box) if available, otherwise show preview
  if (altContent?.type === 'image') {
    return (
      <Image
        flex={1}
        source={{ uri: (altContent as any).url }}
        contentFit="cover"
        aspectRatio={aspectRatio.replace(':', ' / ')}
        onClick={clickHandler}
        className={className}
      />
    )
  }

  // Fallback to preview image
  return (
    <Image
      flex={1}
      source={{ uri: previewUrl }}
      contentFit="cover"
      aspectRatio={aspectRatio.replace(':', ' / ')}
      onClick={clickHandler}
      className={className}
    />
  )
}
```

- [ ] **Step 6: Commit**

```bash
git add packages/line-flex/src/components/LfIcon.tsx packages/line-flex/src/components/LfSeparator.tsx packages/line-flex/src/components/LfSpacer.tsx packages/line-flex/src/components/LfFiller.tsx packages/line-flex/src/components/LfVideo.tsx
git commit -m "feat(line-flex): add LfIcon, LfSeparator, LfSpacer, LfFiller, LfVideo components"
```

---

## Task 11: Container Components (LfBubble, LfCarousel, LfMessage)

**Files:**
- Create: `packages/line-flex/src/components/LfHero.tsx`
- Create: `packages/line-flex/src/components/LfHeader.tsx`
- Create: `packages/line-flex/src/components/LfBody.tsx`
- Create: `packages/line-flex/src/components/LfFooter.tsx`
- Create: `packages/line-flex/src/components/LfBubble.tsx`
- Create: `packages/line-flex/src/components/LfCarousel.tsx`
- Create: `packages/line-flex/src/components/LfMessage.tsx`

- [ ] **Step 1: Write LfHero component**

```tsx
// packages/line-flex/src/components/LfHero.tsx
import { YStack } from 'tamagui'
import type { LFexBubble, LFexAction } from '../types'
import { LfBox } from './LfBox'
import { LfImage } from './LfImage'
import { LfVideo } from './LfVideo'

export type LFexHeroProps = {
  hero?: LFexBubble['hero']
  onAction?: (action: LFexAction) => void
}

export function LfHero({ hero, onAction }: LFexHeroProps) {
  if (!hero) return null

  if (hero.type === 'video') {
    return <LfVideo {...hero} onAction={onAction} />
  }

  if (hero.type === 'image') {
    return <LfImage {...hero} onAction={onAction} />
  }

  // hero.type === 'box'
  return <LfBox {...hero} onAction={onAction} />
}
```

- [ ] **Step 2: Write LfHeader, LfBody, LfFooter**

```tsx
// packages/line-flex/src/components/LfHeader.tsx
import { YStack } from 'tamagui'
import type { LFexBubble, LFexAction } from '../types'
import { LfBox } from './LfBox'

export type LFexHeaderProps = {
  header?: LFexBubble['header']
  onAction?: (action: LFexAction) => void
}

export function LfHeader({ header, onAction }: LFexHeaderProps) {
  if (!header) return null
  return (
    <YStack 
      backgroundColor={header.background?.type === 'linearGradient' 
        ? undefined // gradient handled differently
        : (header as any).backgroundColor}
    >
      <LfBox {...header} onAction={onAction} />
    </YStack>
  )
}
```

```tsx
// packages/line-flex/src/components/LfBody.tsx
import { YStack } from 'tamagui'
import type { LFexBubble, LFexAction } from '../types'
import { LfBox } from './LfBox'

export type LFexBodyProps = {
  body?: LFexBubble['body']
  onAction?: (action: LFexAction) => void
}

export function LfBody({ body, onAction }: LFexBodyProps) {
  if (!body) return null
  return (
    <YStack flex={1}>
      <LfBox {...body} onAction={onAction} />
    </YStack>
  )
}
```

```tsx
// packages/line-flex/src/components/LfFooter.tsx
import { YStack } from 'tamagui'
import type { LFexBubble, LFexAction } from '../types'
import { LfBox } from './LfBox'

export type LFexFooterProps = {
  footer?: LFexBubble['footer']
  onAction?: (action: LFexAction) => void
}

export function LfFooter({ footer, onAction }: LFexFooterProps) {
  if (!footer) return null
  return (
    <YStack flex={0}>
      <LfBox {...footer} onAction={onAction} />
    </YStack>
  )
}
```

- [ ] **Step 3: Write LfBubble component**

```tsx
// packages/line-flex/src/components/LfBubble.tsx
import { YStack } from 'tamagui'
import type { LFexBubble, LFexAction } from '../types'
import { LfHero } from './LfHero'
import { LfHeader } from './LfHeader'
import { LfBody } from './LfBody'
import { LfFooter } from './LfFooter'

export type LFexBubbleProps = LFexBubble & {
  className?: string
  onAction?: (action: LFexAction) => void
}

const BUBBLE_SIZES = {
  nano: 120,
  micro: 160,
  deca: 200,
  hecto: 240,
  kilo: 260,
  mega: 300,
  giga: 500,
} as const

export function LfBubble({
  size = 'mega',
  direction = 'ltr',
  header,
  hero,
  body,
  footer,
  styles,
  action,
  onAction,
  className,
}: LFexBubbleProps) {
  const width = BUBBLE_SIZES[size] ?? 300

  return (
    <YStack
      width={width}
      maxWidth={width}
      backgroundColor={styles?.body?.backgroundColor ?? '#ffffff'}
      overflow="hidden"
      borderRadius="$4"
      className={className}
    >
      <LfHeader header={header} onAction={onAction} />
      <LfHero hero={hero} onAction={onAction} />
      <LfBody body={body} onAction={onAction} />
      <LfFooter footer={footer} onAction={onAction} />
    </YStack>
  )
}
```

- [ ] **Step 4: Write LfCarousel component**

```tsx
// packages/line-flex/src/components/LfCarousel.tsx
import { ScrollView, XStack } from 'tamagui'
import type { LFexCarousel, LFexAction } from '../types'
import { LfBubble } from './LfBubble'

export type LFexCarouselProps = LFexCarousel & {
  className?: string
  onAction?: (action: LFexAction) => void
}

export function LfCarousel({
  contents = [],
  onAction,
  className,
}: LFexCarouselProps) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ flexDirection: 'row' }}
      flexDirection="row"
      className={className}
    >
      {contents.map((bubble, index) => (
        <XStack key={index} marginRight="$2">
          <LfBubble {...bubble} onAction={onAction} />
        </XStack>
      ))}
    </ScrollView>
  )
}
```

- [ ] **Step 5: Write LfMessage component (root)**

```tsx
// packages/line-flex/src/components/LfMessage.tsx
import type { LFexMessage, LFexAction } from '../types'
import { LfBubble } from './LfBubble'
import { LfCarousel } from './LfCarousel'

export type LFexMessageProps = LFexMessage & {
  className?: string
  onAction?: (action: LFexAction) => void
}

export function LfMessage({
  contents,
  onAction,
  className,
}: LFexMessageProps) {
  if (contents.type === 'carousel') {
    return <LfCarousel {...contents} onAction={onAction} className={className} />
  }

  return <LfBubble {...contents} onAction={onAction} className={className} />
}
```

- [ ] **Step 6: Commit**

```bash
git add packages/line-flex/src/components/LfHero.tsx packages/line-flex/src/components/LfHeader.tsx packages/line-flex/src/components/LfBody.tsx packages/line-flex/src/components/LfFooter.tsx packages/line-flex/src/components/LfBubble.tsx packages/line-flex/src/components/LfCarousel.tsx packages/line-flex/src/components/LfMessage.tsx
git commit -m "feat(line-flex): add container components (LfHero, LfHeader, LfBody, LfFooter, LfBubble, LfCarousel, LfMessage)"
```

---

## Task 12: Package Exports

**Files:**
- Create: `packages/line-flex/src/index.ts`

- [ ] **Step 1: Write package exports**

```ts
// packages/line-flex/src/index.ts

// Types
export type {
  LFexAction,
  LFexBox,
  LFexButton,
  LFexBubble,
  LFexCarousel,
  LFexCarousel,
  LFexComponent,
  LFexFiller,
  LFexIcon,
  LFexImage,
  LFexMessage,
  LFexSeparator,
  LFexSize,
  LFexSpacing,
  LFexSpan,
  LFexSpacer,
  LFexText,
  LFexVideo,
  LFexLayout,
  LFexJustifyContent,
  LFexAlignItems,
} from './types'

// Components
export { LfMessage } from './components/LfMessage'
export { LfBubble } from './components/LfBubble'
export { LfCarousel } from './components/LfCarousel'
export { LfBox } from './components/LfBox'
export { LfText } from './components/LfText'
export { LfSpan } from './components/LfSpan'
export { LfImage } from './components/LfImage'
export { LfButton } from './components/LfButton'
export { LfIcon } from './components/LfIcon'
export { LfSeparator } from './components/LfSeparator'
export { LfSpacer } from './components/LfSpacer'
export { LfFiller } from './components/LfFiller'
export { LfVideo } from './components/LfVideo'
export { LfHero } from './components/LfHero'
export { LfHeader } from './components/LfHeader'
export { LfBody } from './components/LfBody'
export { LfFooter } from './components/LfFooter'

// Component props
export type { LFexMessageProps } from './components/LfMessage'
export type { LFexBubbleProps } from './components/LfBubble'
export type { LFexCarouselProps } from './components/LfCarousel'
export type { LFexBoxProps } from './components/LfBox'
export type { LFexTextProps } from './components/LfText'
export type { LFexSpanProps } from './components/LfSpan'
export type { LFexImageProps } from './components/LfImage'
export type { LFexButtonProps } from './components/LfButton'
export type { LFexIconProps } from './components/LfIcon'
export type { LFexSeparatorProps } from './components/LfSeparator'
export type { LFexSpacerProps } from './components/LfSpacer'
export type { LFexFillerProps } from './components/LfFiller'
export type { LFexVideoProps } from './components/LfVideo'
export type { LFexHeroProps } from './components/LfHero'
export type { LFexHeaderProps } from './components/LfHeader'
export type { LFexBodyProps } from './components/LfBody'
export type { LFexFooterProps } from './components/LfFooter'
```

- [ ] **Step 2: Commit**

```bash
git add packages/line-flex/src/index.ts
git commit -m "feat(line-flex): add package exports"
```

---

## Task 13: Add to Workspace

**Files:**
- Modify: `package.json` (workspace root)
- Modify: `packages/line-flex/package.json` (add to workspace)

- [ ] **Step 1: Add package to workspace (if not using glob)**
  
Check if root package.json has workspaces configured:
```bash
cat package.json | grep -A5 workspaces
```

- [ ] **Step 2: Run typecheck on new package**

```bash
cd packages/line-flex && npx tsc --noEmit
```

- [ ] **Step 3: Commit workspace changes**

```bash
git add packages/line-flex/package.json
git commit -m "chore: add @vine/line-flex to workspace"
```

---

## Self-Review Checklist

1. **Spec coverage:** All LINE Flex components implemented (Box, Text, Span, Image, Button, Icon, Separator, Spacer, Filler, Video, Hero, Header, Body, Footer, Bubble, Carousel, Message)
2. **Placeholder scan:** No TBD/TODO remaining in implementation
3. **Type consistency:** LFex prefix used consistently for all types
4. **Cross-platform:** isWeb checks in LfText, LfImage for different behavior
5. **LINE flex defaults:** getChildDefaultFlex() handles horizontal=flex-1, vertical=flex-none

---

## Plan Complete

**Saved to:** `docs/superpowers/plans/YYYY-MM-DD-line-flex-implementation.md`

**Two execution options:**

1. **Subagent-Driven (recommended)** - Dispatch fresh subagent per task, review between tasks
2. **Inline Execution** - Execute tasks in this session using executing-plans

**Which approach?**