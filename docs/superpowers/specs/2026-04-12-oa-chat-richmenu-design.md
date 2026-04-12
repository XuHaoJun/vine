# OA Chat Rich Menu — Frontend UI/UX Design

**Date:** 2026-04-12
**Status:** Approved
**Scope:** Display rich menu in OA chat room (not OA rich menu management interface)

## Context

The backend implements 19+ LINE-compatible rich menu REST endpoints (`apps/server/src/plugins/oa-richmenu.ts`). The OA chat room (`apps/web/app/(app)/home/(tabs)/talks/[chatId].tsx`) currently has no rich menu display. This spec defines how the rich menu appears and behaves in the OA chat UI.

## Two Input Modes

When an OA has a rich menu set, the bottom input area supports two modes. When no rich menu exists, only Normal Mode is available.

### Normal Mode (default when no rich menu)

Standard text input bar:
- Left: `+` button (round, gray)
- Camera icon, Photo icon
- Text input (rounded, `Aa` placeholder)
- Emoji icon (inside input, right)
- Mic/Send icon (right)

**When OA has rich menu:** `+` button replaces with 📋 menu icon. Tapping it switches to Rich Menu Mode.

### Rich Menu Mode (when OA has rich menu)

Input area is replaced entirely:

```
┌─────────────────────────────────────┐
│  Rich Menu Image (expanded)         │  ← aspect-ratio from size (e.g. 2500:1686)
│  Tappable areas overlaid            │
├─────────────────────────────────────┤
│ ⌨️  │       Tap to open ▲          │  ← chat bar (light style, white bg)
└─────────────────────────────────────┘
```

- **Rich menu image**: Full-width, aspect-ratio preserved from `size.width/size.height`
- **Tappable areas**: Invisible overlay positioned by ratio (`area.x/size.width`, etc.)
- **Chat bar**: White background, left has ⌨️ icon (→ switch to Normal Mode), center shows `chatBarText` (tap to toggle expand/collapse)
- **Collapsed state**: Menu image hidden completely, only chat bar visible. Arrow indicator: ▼

## State Matrix

| Condition | Mode | Left Icon | Rich Menu |
|-----------|------|-----------|-----------|
| No rich menu | Normal | `+` | Hidden |
| Has rich menu, `selected: false` | Rich Menu | ⌨️ | Collapsed |
| Has rich menu, `selected: true` | Rich Menu | ⌨️ | Expanded |
| User taps ⌨️ | → Normal | 📋 | Hidden |
| User taps 📋 | → Rich Menu | ⌨️ | Collapsed |

## Mode Switching

- **📋 icon** (Normal Mode left): Switch to Rich Menu Mode, collapsed state
- **⌨️ icon** (Rich Menu Mode left): Switch to Normal Mode
- **Chat bar text** (Rich Menu Mode center): Toggle expand/collapse of rich menu image
- Only visible when OA has a rich menu set

## Data Flow

1. Enter OA chat → query per-user rich menu: `GET /v2/bot/user/:userId/richmenu`
2. If no per-user → query default: `GET /v2/bot/user/all/richmenu`
3. If rich menu ID exists → fetch object: `GET /v2/bot/richmenu/:id` → `RichMenuObject`
4. Fetch image: `GET /v2/bot/richmenu/:id/content` → image URL/blob
5. Render image with tappable area overlays (proportional to rich menu size)
6. On area tap → handle by `action.type`:
   - `uri` → open URL in browser
   - `postback` → send postback data to backend
   - `message` → send text message in chat

## Rich Menu Object Reference

```typescript
type RichMenuObject = {
  size: { width: number; height: number }  // 800-2500 x 250-1686, ratio >= 1.45
  selected: boolean                         // auto-expand on link
  name: string                              // max 300 chars
  chatBarText: string                       // max 14 chars
  areas: RichMenuArea[]                     // max 20
}

type RichMenuArea = {
  bounds: { x: number; y: number; width: number; height: number }
  action: {
    type: 'postback' | 'message' | 'uri' | 'datetimepicker' | 'richmenuswitch' | 'camera' | 'cameraRoll' | 'location'
    label?: string
    uri?: string
    data?: string
    text?: string
    richMenuAliasId?: string
    inputOption?: string
    displayText?: string
  }
}
```

## Files to Modify/Create

| File | Action |
|------|--------|
| `apps/web/src/features/chat/ui/RichMenu.tsx` | **Create** — Rich menu image + tap area overlay component |
| `apps/web/src/features/chat/ui/RichMenuBar.tsx` | **Create** — Chat bar (⌨️ + chatBarText) component |
| `apps/web/src/features/chat/ui/MessageInput.tsx` | **Modify** — Support `richMenu` prop for mode switching |
| `apps/web/app/(app)/home/(tabs)/talks/[chatId].tsx` | **Modify** — Fetch rich menu, manage mode state, render rich menu |
| `apps/web/src/features/chat/useRichMenu.ts` | **Create** — Hook to fetch rich menu data + image |
| `apps/web/src/features/oa/client.ts` | **Modify** — Add rich menu API client methods |

## Styling Notes

- Chat bar and collapsed state use **light style**: white background, `#e5e5e7` border, dark text (`#555`), light arrow (`#aaa`)
- Consistent with `MessageInput` component styling
- Rich menu image: full-width, no border radius, fills available space above chat bar
- Tappable area overlay: invisible by default, optional debug highlight
