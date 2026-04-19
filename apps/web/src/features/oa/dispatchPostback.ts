type DispatchPostbackInput = {
  oaId: string
  chatId: string
  data: string
  params?: { date?: string; time?: string; datetime?: string }
}

type DispatchPostbackResult = { success: boolean; reason?: string }

const ENDPOINT = '/api/oa/internal/dispatch-postback'

/**
 * Dispatch a postback event to the OA's webhook URL.
 *
 * The acting user is derived server-side from the session — do not send
 * `userId` from the client. The server also enforces that the session user
 * is a member of `chatId` before delivering the event.
 */
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
