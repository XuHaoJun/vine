export type LiffOS = 'ios' | 'android' | 'web'

export type VineLiffBootstrap = {
  apiBaseUrl?: string
  liffId?: string
  endpointOrigin?: string
  accessToken?: string
  chatId?: string
  contextType?: 'utou' | 'group' | 'external'
  lineVersion?: string
}

export type LiffAvailability = {
  shareTargetPicker: { permission: boolean }
  multipleLiffTransition: { permission: boolean }
  subwindowOpen: { permission: boolean }
  scanCode: { permission: boolean }
  scanCodeV2: { permission: boolean }
  createShortcutOnHomeScreen: { permission: boolean }
}

export type LiffMenuColorScheme = {
  iconColor: string
  statusBarColor: string
  titleTextColor: string
  titleSubtextColor: string
  titleButtonColor: string
  titleBackgroundColor: string
  progressBarColor: string
  progressBackgroundColor: string
}

export type LiffMenuColorSetting = {
  adaptableColorSchemes: string[]
  lightModeColor: LiffMenuColorScheme
}

export type LiffContext = {
  type: 'none' | 'utou' | 'room' | 'group' | 'square_chat' | 'external'
  userId: string | undefined
  liffId: string
  viewType: 'compact' | 'tall' | 'full'
  endpointUrl: string
  accessTokenHash: string
  scope: string[]
  availability: LiffAvailability
  menuColorSetting: LiffMenuColorSetting
}

export type DecodedIDToken = {
  iss: string
  sub: string
  aud: string
  exp: number
  iat: number
  name?: string
  picture?: string
  email?: string
}

export type LiffProfile = {
  userId: string
  displayName: string
  pictureUrl: string | undefined
  statusMessage: string | undefined
}

type LiffConfig = {
  liffId: string
}

type LiffAppConfig = {
  liffId: string
  viewType: string
  endpointUrl: string
  scopes: string[]
  moduleMode: boolean
  botPrompt: string
}

const DEFAULT_MENU_COLOR_SETTING: LiffMenuColorSetting = {
  adaptableColorSchemes: ['light'],
  lightModeColor: {
    iconColor: '#111111',
    statusBarColor: 'black',
    titleTextColor: '#111111',
    titleSubtextColor: '#B7B7B7',
    titleButtonColor: '#111111',
    titleBackgroundColor: '#FFFFFF',
    progressBarColor: '#06C755',
    progressBackgroundColor: '#FFFFFF',
  },
}

async function computeAccessTokenHash(token: string): Promise<string> {
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    try {
      const encoder = new TextEncoder()
      const data = encoder.encode(token)
      const hashBuffer = await crypto.subtle.digest('SHA-256', data)
      const hashArray = Array.from(new Uint8Array(hashBuffer))
      const hashHex = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')
      return hashHex.slice(0, hashHex.length / 2)
    } catch {
      return ''
    }
  }
  return ''
}

class LiffImpl {
  private _liffId: string | null = null
  private _initialized = false
  private _accessToken: string | null = null
  private _idToken: string | null = null
  private _accessTokenHash: string = ''
  private _appConfig: LiffAppConfig | null = null
  private _bootstrap: VineLiffBootstrap = {}
  private _readyResolve: (() => void) | null = null

  readonly ready: Promise<void>

  constructor() {
    this.ready = new Promise<void>((resolve) => {
      this._readyResolve = resolve
    })
  }

  getBootstrap(): VineLiffBootstrap {
    if (typeof window === 'undefined') return {}
    const w = window as any
    if (w['VineLIFF']) return w['VineLIFF'] as VineLiffBootstrap
    return this._bootstrap
  }

  getApiBaseUrl(): string {
    const bootstrap = this.getBootstrap()
    return (
      bootstrap.apiBaseUrl ??
      (typeof window !== 'undefined' ? window.location.origin : '')
    )
  }

  private _requestBootstrap(liffId: string): Promise<VineLiffBootstrap> {
    return new Promise((resolve) => {
      const requestId = `req_${Date.now()}_${Math.random().toString(36).slice(2)}`
      const timeout = setTimeout(() => {
        window.removeEventListener('message', handler)
        resolve({})
      }, 3000)
      const handler = (event: MessageEvent) => {
        const data = event.data as Record<string, unknown> | undefined
        if (data?.type === 'liff:bootstrap:done' && data.requestId === requestId) {
          clearTimeout(timeout)
          window.removeEventListener('message', handler)
          resolve((data.bootstrap as VineLiffBootstrap) ?? {})
        }
      }
      window.addEventListener('message', handler)
      window.parent.postMessage({ type: 'liff:bootstrap', requestId, liffId }, '*')
    })
  }

  async init(config: LiffConfig): Promise<void> {
    this._liffId = config.liffId

    if (typeof window !== 'undefined') {
      const w = window as any
      if (!w['VineLIFF']) {
        this._bootstrap = await this._requestBootstrap(config.liffId)
      }
      const bootstrap = this.getBootstrap()
      if (bootstrap.accessToken) {
        this._accessToken = bootstrap.accessToken
      }
    }

    const apiBase = this.getApiBaseUrl()
    const res = await fetch(`${apiBase}/liff/v1/apps/${config.liffId}`)
    if (!res.ok) {
      throw new Error(`LIFF init failed: liffId "${config.liffId}" not found`)
    }

    const appConfig = (await res.json()) as LiffAppConfig
    this._appConfig = appConfig

    if (typeof window !== 'undefined') {
      const hash = window.location.hash.slice(1)
      if (hash) {
        const params = new URLSearchParams(hash)
        const token = params.get('access_token')
        const idToken = params.get('id_token')
        const hasToken = token || idToken
        if (token) {
          this._accessToken = token
        }
        if (idToken) {
          this._idToken = idToken
        }
        if (hasToken) {
          const cleaned = new URLSearchParams(hash)
          cleaned.delete('access_token')
          cleaned.delete('id_token')
          const cleanedStr = cleaned.toString()
          const newHash = cleanedStr ? `#${cleanedStr}` : ''
          window.history.replaceState(
            null,
            '',
            window.location.pathname + window.location.search + newHash,
          )
        }
      }
      if (!this._accessToken) {
        const stored = sessionStorage.getItem(`vine_liff_token_${config.liffId}`)
        if (stored) this._accessToken = stored
      }
      if (!this._idToken) {
        const storedIdToken = sessionStorage.getItem(`vine_liff_idtoken_${config.liffId}`)
        if (storedIdToken) this._idToken = storedIdToken
      }
      if (this._accessToken) {
        sessionStorage.setItem(`vine_liff_token_${config.liffId}`, this._accessToken)
        this._accessTokenHash = await computeAccessTokenHash(this._accessToken)
      }
      if (this._idToken) {
        sessionStorage.setItem(`vine_liff_idtoken_${config.liffId}`, this._idToken)
      }
    }

    this._initialized = true
    this._readyResolve?.()
  }

  getOS(): LiffOS {
    if (typeof navigator === 'undefined') return 'web'
    const ua = navigator.userAgent
    if (/iPad|iPhone|iPod/.test(ua)) return 'ios'
    if (/Android/.test(ua)) return 'android'
    return 'web'
  }

  getAppLanguage(): string {
    if (typeof navigator !== 'undefined' && navigator.language) {
      return navigator.language
    }
    return 'en'
  }

  getVersion(): string {
    return '2.22.0'
  }

  getLineVersion(): string {
    if (typeof window !== 'undefined' && (window as any).VineLIFF?.lineVersion) {
      return (window as any).VineLIFF.lineVersion
    }
    return '14.0.0'
  }

  isInClient(): boolean {
    return (
      typeof window !== 'undefined' &&
      (!!(window as any).VineLIFF || Object.keys(this._bootstrap).length > 0)
    )
  }

  isLoggedIn(): boolean {
    return !!this._accessToken
  }

  login(params?: { redirectUri?: string }): void {
    if (typeof window === 'undefined') return
    const redirectUri = params?.redirectUri ?? window.location.href
    const liffId = this._liffId ?? ''
    const authUrl = new URL('/oauth2/v2.1/authorize', window.location.origin)
    authUrl.searchParams.set('response_type', 'token')
    authUrl.searchParams.set('client_id', liffId.split('-')[0] ?? liffId)
    authUrl.searchParams.set('redirect_uri', redirectUri)
    authUrl.searchParams.set('scope', 'profile openid')
    authUrl.searchParams.set('state', liffId)
    window.location.href = authUrl.toString()
  }

  logout(): void {
    this._accessToken = null
    this._idToken = null
    this._accessTokenHash = ''
    if (typeof sessionStorage !== 'undefined' && this._liffId) {
      sessionStorage.removeItem(`vine_liff_token_${this._liffId}`)
      sessionStorage.removeItem(`vine_liff_idtoken_${this._liffId}`)
    }
  }

  getAccessToken(): string | null {
    return this._accessToken
  }

  getIDToken(): string | null {
    return this._idToken
  }

  getDecodedIDToken(): DecodedIDToken | null {
    if (!this._idToken) return null
    try {
      const payload = this._idToken.split('.')[1]
      if (!payload) return null
      return JSON.parse(atob(payload)) as DecodedIDToken
    } catch {
      return null
    }
  }

  async getProfile(): Promise<LiffProfile> {
    if (!this._accessToken) throw new Error('Not logged in')
    const apiBase = this.getApiBaseUrl()
    const liffId = this._liffId ?? ''
    const res = await fetch(
      `${apiBase}/liff/v1/me?liffId=${encodeURIComponent(liffId)}`,
      { headers: { Authorization: `Bearer ${this._accessToken}` } },
    )
    if (!res.ok) throw new Error('Failed to get profile')
    return res.json() as Promise<LiffProfile>
  }

  async getFriendship(): Promise<{ friendFlag: boolean }> {
    if (!this._accessToken) throw new Error('Not logged in')
    const apiBase = this.getApiBaseUrl()
    const liffId = this._liffId ?? ''
    const res = await fetch(
      `${apiBase}/liff/v1/friendship?liffId=${encodeURIComponent(liffId)}`,
      {
        headers: { Authorization: `Bearer ${this._accessToken}` },
      },
    )
    if (!res.ok) throw new Error('Failed to get friendship')
    return res.json() as Promise<{ friendFlag: boolean }>
  }

  async sendMessages(messages: unknown[]): Promise<void> {
    if (!this.isInClient())
      throw new Error('sendMessages is only available in LIFF browser')
    if (typeof window === 'undefined') return
    const requestId = `req_${Date.now()}_${Math.random().toString(36).slice(2)}`
    return new Promise((resolve, reject) => {
      const handler = (event: MessageEvent) => {
        const data = event.data as Record<string, unknown> | undefined
        if (data?.type === 'liff:sendMessages:done' && data.requestId === requestId) {
          window.removeEventListener('message', handler)
          resolve()
        } else if (
          data?.type === 'liff:sendMessages:error' &&
          data.requestId === requestId
        ) {
          window.removeEventListener('message', handler)
          const err = data.error
          const msg =
            typeof err === 'string'
              ? err
              : err && typeof err === 'object' && 'message' in err
                ? String((err as Record<string, unknown>).message)
                : 'sendMessages failed'
          reject(new Error(msg))
        }
      }
      window.addEventListener('message', handler)
      window.parent.postMessage({ type: 'liff:sendMessages', requestId, messages }, '*')
    })
  }

  openWindow(params: { url: string; external?: boolean }): void {
    if (typeof window === 'undefined') return
    if (params.external) {
      window.open(params.url, '_blank')
    } else {
      window.location.href = params.url
    }
  }

  closeWindow(): void {
    if (typeof window === 'undefined') return
    if (this.isInClient()) {
      window.parent?.postMessage({ type: 'liff:closeWindow' }, '*')
    } else {
      window.close()
    }
  }

  getContext(): LiffContext {
    const bootstrap = this.getBootstrap()
    const cfg = this._appConfig
    return {
      type: bootstrap.contextType ?? 'external',
      userId: this.getDecodedIDToken()?.sub,
      liffId: this._liffId ?? '',
      viewType: (cfg?.viewType as LiffContext['viewType']) ?? 'full',
      endpointUrl: cfg?.endpointUrl ?? '',
      accessTokenHash: this._accessTokenHash,
      scope: cfg?.scopes ?? [],
      availability: {
        shareTargetPicker: { permission: true },
        multipleLiffTransition: { permission: this.isInClient() },
        subwindowOpen: { permission: true },
        scanCode: { permission: false },
        scanCodeV2: { permission: this.isInClient() },
        createShortcutOnHomeScreen: { permission: false },
      },
      menuColorSetting: DEFAULT_MENU_COLOR_SETTING,
    }
  }

  async scanCodeV2(): Promise<{ value: string }> {
    if (!this.isInClient())
      throw new Error('scanCodeV2 is only available in LIFF browser')
    const TIMEOUT_MS = 120_000
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        window.removeEventListener('message', handler)
        reject(new Error('Scan timed out'))
      }, TIMEOUT_MS)
      const handler = (event: MessageEvent) => {
        if (event.data?.type === 'liff:scanCodeResult') {
          clearTimeout(timeoutId)
          window.removeEventListener('message', handler)
          if (event.data.value) {
            resolve({ value: event.data.value as string })
          } else {
            reject(new Error('Scan cancelled'))
          }
        }
      }
      window.addEventListener('message', handler)
      window.parent?.postMessage({ type: 'liff:scanCode' }, '*')
    })
  }

  isApiAvailable(apiName: string): boolean {
    const inClient = this.isInClient()
    const ctx = this.getContext()
    const map: Record<string, boolean> = {
      shareTargetPicker: true,
      sendMessages: ctx.availability.subwindowOpen.permission && inClient,
      closeWindow: true,
      scanCodeV2: ctx.availability.scanCodeV2.permission,
      multipleLiffTransition:
        ctx.availability.multipleLiffTransition.permission && inClient,
      createShortcutOnHomeScreen: ctx.availability.createShortcutOnHomeScreen.permission,
      skipChannelVerificationScreen: false,
      iap: false,
      scanCode: ctx.availability.scanCode.permission,
    }
    return map[apiName] ?? false
  }

  permanentLink = {
    createUrlBy: (url: string): string => {
      if (typeof window === 'undefined') return url
      const apiBase = this.getApiBaseUrl()
      const liffBase = `${apiBase}/liff/${this._liffId ?? ''}`
      try {
        const target = new URL(url)
        return `${liffBase}${target.pathname}${target.search}${target.hash}`
      } catch {
        return liffBase
      }
    },
  }

  async shareTargetPicker(
    messages: { type: string; text?: string }[],
    options?: { isMultiple?: boolean },
  ): Promise<{ status: 'sent' } | false> {
    if (typeof window === 'undefined') return false

    const TIMEOUT_MS = 120_000
    return new Promise((resolve) => {
      const timeoutId = setTimeout(() => {
        window.removeEventListener('message', handler)
        resolve(false)
      }, TIMEOUT_MS)
      const handler = (event: MessageEvent) => {
        if (event.data?.type === 'liff:shareTargetPicker:done') {
          clearTimeout(timeoutId)
          window.removeEventListener('message', handler)
          const result = event.data as { status: 'sent' } | false
          resolve(result)
        }
      }
      window.addEventListener('message', handler)
      window.parent?.postMessage(
        {
          type: 'liff:shareTargetPicker',
          messages,
          options: { isMultiple: options?.isMultiple ?? true },
        },
        '*',
      )
    })
  }
}

export const liff = new LiffImpl()
