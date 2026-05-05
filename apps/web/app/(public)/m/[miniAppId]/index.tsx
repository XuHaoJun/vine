import { useLoader, createRoute } from 'one'

import { MiniAppShell } from '~/features/mini-app/MiniAppShell'

const route = createRoute<'/(public)/m/[miniAppId]'>()

type MiniAppData = {
  id: string
  name: string
  iconUrl: string | null
  description: string | null
  category: string | null
  liffId: string | null
  isPublished: boolean
  linkedOaIds: string[]
}

export async function loader({ params }: { params: { miniAppId: string } }) {
  const { miniAppId } = params
  const baseUrl = process.env.ONE_SERVER_URL || 'http://localhost:3001'
  const res = await fetch(`${baseUrl}/api/liff/v1/mini-app/${miniAppId}`)

  if (res.status === 404) {
    return Response.json({ error: 'not found' }, { status: 404 })
  }

  if (!res.ok) {
    return Response.json({ error: 'server error' }, { status: 500 })
  }

  const miniApp: MiniAppData = await res.json()

  if (!miniApp.isPublished) {
    return { miniApp, allowed: false }
  }

  return { miniApp, allowed: true }
}

export default function MiniAppPage() {
  const data = useLoader(loader)

  if (!data || 'error' in data) {
    return (
      <div style={{ padding: 32, textAlign: 'center' }}>
        <h2>Mini App not found</h2>
        <p>The Mini App you are looking for does not exist.</p>
      </div>
    )
  }

  const { miniApp, allowed } = data as { miniApp: MiniAppData; allowed: boolean }

  if (!allowed) {
    return (
      <div style={{ padding: 32, textAlign: 'center' }}>
        <h2>Not yet published</h2>
        <p>This Mini App is not available yet.</p>
      </div>
    )
  }

  if (!miniApp.liffId) {
    return (
      <div style={{ padding: 32, textAlign: 'center' }}>
        <h2>No LIFF app configured</h2>
        <p>This Mini App does not have a LIFF app linked yet.</p>
      </div>
    )
  }

  return <MiniAppShell miniApp={miniApp} />
}
