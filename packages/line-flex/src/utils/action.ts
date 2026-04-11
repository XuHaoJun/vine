import type { LFexAction } from '../types'

export function handleAction(
  action: LFexAction | undefined,
  onAction: ((action: LFexAction) => void) | undefined,
): ((event: any) => void) | undefined {
  if (!action || !onAction) return undefined
  return (event: any) => {
    event.preventDefault?.()
    onAction(action)
  }
}
