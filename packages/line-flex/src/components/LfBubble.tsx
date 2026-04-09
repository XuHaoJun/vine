import { YStack } from 'tamagui'
import type { LFexBubble, LFexAction, LFexBox } from '../types'
import { LfHero } from './LfHero'
import { LfHeader } from './LfHeader'
import { LfBody } from './LfBody'
import { LfFooter } from './LfFooter'

export type LFexBubbleProps = LFexBubble & {
  className?: string
  onAction?: (action: LFexAction) => void
}

const BUBBLE_SIZES = {
  nano: { width: 120, height: 120 },
  micro: { width: 160, height: 160 },
  deca: { width: 200, height: 200 },
  hecto: { width: 240, height: 240 },
  kilo: { width: 260, height: 260 },
  mega: { width: 300, height: 300 },
  giga: { width: 500, height: 500 },
} as const

function getDefaultBodyPadding(size: keyof typeof BUBBLE_SIZES) {
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

function getDefaultHeaderFooterPadding(size: keyof typeof BUBBLE_SIZES) {
  if (size === 'nano' || size === 'micro') {
    return { paddingAll: '10px' }
  }
  return { paddingAll: '11px' }
}

function mergeBodyProps(
  body: LFexBox | undefined,
  size: keyof typeof BUBBLE_SIZES,
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
  size: keyof typeof BUBBLE_SIZES,
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
  size: keyof typeof BUBBLE_SIZES,
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
}: LFexBubbleProps) {
  const mergedHeader = mergeHeaderProps(header, size)
  const mergedBody = mergeBodyProps(body, size)
  const mergedFooter = mergeFooterProps(footer, size)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const props: any = {
    background: styles?.body?.backgroundColor ?? '#ffffff',
    overflow: 'hidden',
    borderRadius: '$4',
    className,
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
