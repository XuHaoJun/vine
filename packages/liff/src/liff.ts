export type LiffOS = 'ios' | 'android' | 'web'

export type LiffContext = {
  type: 'none' | 'utou' | 'room' | 'group' | 'square_chat' | 'external'
  userId: string | undefined
  viewType: string
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

class LiffImpl {
  private _liffId: string | null = null
  private _initialized = false
  private _accessToken: string | null = null
  private _idToken: string | null = null
  private _readyResolve: (() => void) | null = null

  readonly ready: Promise<void>

  constructor() {
    this.ready = new Promise<void>((resolve) => {
      this._readyResolve = resolve
    })
  }

  async init(config: LiffConfig): Promise<void> {
    this._liffId = config.liffId

    const apiBase = typeof window !== 'undefined' ? window.location.origin : ''
    const res = await fetch(`${apiBase}/liff/v1/apps/${config.liffId}`)
    if (!res.ok) {
      throw new Error(`LIFF init failed: liffId "${config.liffId}" not found`)
    }

    if (typeof window !== 'undefined') {
      const hash = new URLSearchParams(window.location.hash.slice(1))
      const token = hash.get('access_token')
      if (token) {
        this._accessToken = token
        window.history.replaceState(
          null,
          '',
          window.location.pathname + window.location.search,
        )
      }
      if (!this._accessToken) {
        const stored = sessionStorage.getItem(`vine_liff_token_${config.liffId}`)
        if (stored) this._accessToken = stored
      }
      if (this._accessToken) {
        sessionStorage.setItem(`vine_liff_token_${config.liffId}`, this._accessToken)
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
    return typeof window !== 'undefined' && !!(window as any).VineLIFF
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
    if (typeof sessionStorage !== 'undefined' && this._liffId) {
      sessionStorage.removeItem(`vine_liff_token_${this._liffId}`)
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
    const apiBase = typeof window !== 'undefined' ? window.location.origin : ''
    const res = await fetch(`${apiBase}/liff/v1/me`, {
      headers: { Authorization: `Bearer ${this._accessToken}` },
    })
    if (!res.ok) throw new Error('Failed to get profile')
    return res.json() as Promise<LiffProfile>
  }

  async getFriendship(): Promise<{ friendFlag: boolean }> {
    return { friendFlag: false }
  }

  async sendMessages(messages: unknown[]): Promise<void> {
    if (!this.isInClient())
      throw new Error('sendMessages is only available in LIFF browser')
    if (typeof window === 'undefined') return
    window.parent?.postMessage({ type: 'liff:sendMessages', messages }, '*')
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
    return {
      type: 'external',
      userId: this.getDecodedIDToken()?.sub,
      viewType: 'full',
    }
  }

  async scanCodeV2(): Promise<{ value: string }> {
    if (!this.isInClient())
      throw new Error('scanCodeV2 is only available in LIFF browser')
    return new Promise((resolve, reject) => {
      const handler = (event: MessageEvent) => {
        if (event.data?.type === 'liff:scanCodeResult') {
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
    const inClientApis = ['sendMessages', 'scanCodeV2', 'closeWindow']
    if (inClientApis.includes(apiName)) {
      return this.isInClient()
    }
    return true
  }

  permanentLink = {
    createUrlBy: (url: string): string => {
      if (typeof window === 'undefined') return url
      const liffBase = `${window.location.origin}/liff/${this._liffId ?? ''}`
      try {
        const target = new URL(url)
        return `${liffBase}${target.pathname}${target.search}${target.hash}`
      } catch {
        return liffBase
      }
    },
  }
}

export const liff = new LiffImpl()
