export type LiffRuntimeContext = {
  apiBaseUrl: string
  liffId: string
  endpointUrl: string
  endpointOrigin: string
  accessToken?: string
  chatId?: string
  contextType: 'utou' | 'group' | 'external'
  scopes: string[]
  lineVersion: string
}

export function createLiffIframeSrc(context: LiffRuntimeContext): string {
  return context.endpointUrl
}

export function createLiffBootstrap(context: LiffRuntimeContext): {
  apiBaseUrl: string
  liffId: string
  endpointOrigin: string
  accessToken?: string
  chatId?: string
  contextType: 'utou' | 'group' | 'external'
  scopes: string[]
  lineVersion: string
} {
  return {
    apiBaseUrl: context.apiBaseUrl,
    liffId: context.liffId,
    endpointOrigin: context.endpointOrigin,
    accessToken: context.accessToken,
    chatId: context.chatId,
    contextType: context.contextType,
    scopes: context.scopes,
    lineVersion: context.lineVersion,
  }
}

export function getEndpointOrigin(endpointUrl: string): string {
  return new URL(endpointUrl).origin
}

export function isAllowedLiffMessageOrigin(
  eventOrigin: string,
  endpointOrigin: string,
): boolean {
  return eventOrigin === endpointOrigin
}

export function canSendMessages(
  context: LiffRuntimeContext,
): { ok: true } | { ok: false; error: string } {
  if (!context.chatId) {
    return { ok: false, error: 'sendMessages requires a chat context' }
  }
  if (!context.scopes.includes('chat_message.write')) {
    return { ok: false, error: 'sendMessages requires chat_message.write scope' }
  }
  return { ok: true }
}
