type DispatchPostbackInput = {
  oaId: string
  chatId: string
  userId: string
  data: string
  params?: { date?: string; time?: string; datetime?: string }
}

type DispatchPostbackResult = { success: boolean; reason?: string }

const ENDPOINT = '/api/oa/internal/dispatch-postback'

export async function dispatchPostback(
  input: DispatchPostbackInput,
): Promise<DispatchPostbackResult> {
  try {
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(input),
    })
    if (!res.ok) {
      const text = await res.text().catch(() => '')
      return { success: false, reason: `HTTP ${res.status}${text ? `: ${text}` : ''}` }
    }
    return { success: true }
  } catch (err) {
    return { success: false, reason: err instanceof Error ? err.message : String(err) }
  }
}
