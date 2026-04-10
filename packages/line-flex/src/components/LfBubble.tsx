import { YStack } from 'tamagui'
import type { LFexBubble, LFexAction, LFexBox } from '../types'
import { LfHero } from './LfHero'
import { LfHeader } from './LfHeader'
import { LfBody } from './LfBody'
import { LfFooter } from './LfFooter'

export type LFexBubbleProps = LFexBubble & {
  className?: string
  onAction?: (action: LFexAction) => void
  shrink?: number
}

const BUBBLE_MAX_WIDTHS = {
  nano: 120,
  micro: 160,
  deca: 220,
  hecto: 241,
  kilo: 260,
  mega: 300,
  giga: 500,
} as const

const BUBBLE_BORDER_RADII = {
  nano: 10,
  micro: 10,
  deca: 10,
  hecto: 10,
  kilo: 10,
  mega: 17,
  giga: 5,
} as const

type BubbleSize = keyof typeof BUBBLE_MAX_WIDTHS

function getDefaultBodyPadding(size: BubbleSize) {
  if (size === 'mega' || size === 'giga') {
    return {
      paddingAll: '20px',
      paddingTop: '19px',
    }
  }
  if (size === 'kilo') {
    return { paddingAll: '13px' }
  }
  if (size === 'nano' || size === 'micro') {
    return { paddingAll: '10px' }
  }
  return { paddingAll: '11px' }
}

function getDefaultHeaderFooterPadding(size: BubbleSize) {
  if (size === 'nano' || size === 'micro') {
    return { paddingAll: '10px' }
  }
  return { paddingAll: '11px' }
}

function mergeBodyProps(
  body: LFexBox | undefined,
  size: BubbleSize,
): LFexBox | undefined {
  if (!body) return undefined
  const hasPadding =
    body.paddingAll !== undefined ||
    body.paddingTop !== undefined ||
    body.paddingBottom !== undefined
  if (hasPadding) return body
  return { ...body, ...getDefaultBodyPadding(size) }
}

function mergeHeaderProps(
  header: LFexBox | undefined,
  size: BubbleSize,
): LFexBox | undefined {
  if (!header) return undefined
  const hasPadding =
    header.paddingAll !== undefined ||
    header.paddingTop !== undefined ||
    header.paddingBottom !== undefined
  if (hasPadding) return header
  return { ...header, ...getDefaultHeaderFooterPadding(size) }
}

function mergeFooterProps(
  footer: LFexBox | undefined,
  size: BubbleSize,
): LFexBox | undefined {
  if (!footer) return undefined
  const hasPadding =
    footer.paddingAll !== undefined ||
    footer.paddingTop !== undefined ||
    footer.paddingBottom !== undefined
  if (hasPadding) return footer
  return { ...footer, ...getDefaultHeaderFooterPadding(size) }
}

export function LfBubble({
  size = 'mega',
  direction,
  header,
  hero,
  body,
  footer,
  styles,
  action,
  onAction,
  className,
  shrink,
}: LFexBubbleProps) {
  const mergedHeader = mergeHeaderProps(header, size)
  const mergedBody = mergeBodyProps(body, size)
  const mergedFooter = mergeFooterProps(footer, size)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const props: any = {
    background: styles?.body?.backgroundColor ?? '#ffffff',
    overflow: 'hidden',
    maxWidth: BUBBLE_MAX_WIDTHS[size],
    borderRadius: BUBBLE_BORDER_RADII[size],
    className,
    ...(shrink !== undefined && { shrink }),
  }

  return (
    <YStack {...props}>
      <LfHeader header={mergedHeader} onAction={onAction} />
      <LfHero hero={hero} onAction={onAction} />
      <LfBody body={mergedBody} onAction={onAction} />
      <LfFooter footer={mergedFooter} onAction={onAction} />
    </YStack>
  )
}
