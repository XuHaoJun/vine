export const LIFF_LINE_VERSION = '14.0.0' as const

export type LiffAppConfig = {
  liffId: string
  viewType: string
  endpointUrl: string
  moduleMode: boolean
  scopes: string[]
  botPrompt: string
  qrCode: boolean
}

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

export async function resolveLiffLaunchContext(input: {
  apiBaseUrl: string
  liffId: string
  launchToken?: string | null
}): Promise<{ chatId?: string; contextType: 'utou' | 'group' | 'external' }> {
  if (!input.launchToken) {
    return { contextType: 'external' }
  }
  try {
    const res = await fetch(
      `${input.apiBaseUrl}/liff/v1/launch-context?liffId=${encodeURIComponent(input.liffId)}&launchToken=${encodeURIComponent(input.launchToken)}`,
    )
    if (!res.ok) {
      return { contextType: 'external' }
    }
    const data = (await res.json()) as { chatId?: string; contextType: 'utou' | 'group' }
    return { chatId: data.chatId, contextType: data.contextType }
  } catch {
    return { contextType: 'external' }
  }
}

export async function createLiffAccessToken(input: {
  apiBaseUrl: string
  liffId: string
}): Promise<string | undefined> {
  try {
    const res = await fetch(`${input.apiBaseUrl}/liff/v1/access-token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ liffId: input.liffId }),
    })
    if (!res.ok) return undefined
    const data = (await res.json()) as { accessToken: string }
    return data.accessToken
  } catch {
    return undefined
  }
}

export function buildNativeAckJavaScript(ack: Record<string, unknown>): string {
  return `window.dispatchEvent(new MessageEvent('message', { data: ${JSON.stringify(ack)} })); true;`
}

export async function buildLiffRuntimeContext(input: {
  apiBaseUrl: string
  liffId: string
  launchToken?: string | null
}): Promise<LiffRuntimeContext> {
  const res = await fetch(`${input.apiBaseUrl}/liff/v1/apps/${input.liffId}`)
  if (!res.ok) {
    throw new Error(`LIFF app "${input.liffId}" not found`)
  }
  const appConfig = (await res.json()) as LiffAppConfig

  const [launchCtx, accessToken] = await Promise.all([
    resolveLiffLaunchContext({
      apiBaseUrl: input.apiBaseUrl,
      liffId: input.liffId,
      launchToken: input.launchToken,
    }),
    createLiffAccessToken({
      apiBaseUrl: input.apiBaseUrl,
      liffId: input.liffId,
    }),
  ])

  return {
    apiBaseUrl: input.apiBaseUrl,
    liffId: input.liffId,
    endpointUrl: appConfig.endpointUrl,
    endpointOrigin: getEndpointOrigin(appConfig.endpointUrl),
    accessToken,
    chatId: launchCtx.chatId,
    contextType: launchCtx.contextType,
    scopes: appConfig.scopes,
    lineVersion: LIFF_LINE_VERSION,
  }
}
