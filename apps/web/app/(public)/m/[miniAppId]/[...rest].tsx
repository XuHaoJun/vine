import { useLoader, useActiveParams, createRoute } from 'one'

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

export async function loader({
  params,
  search,
}: {
  params: { miniAppId: string; rest: string[] }
  search?: string
}) {
  const { miniAppId, rest } = params
  const baseUrl = process.env.ONE_SERVER_URL || 'http://localhost:3001'
  const res = await fetch(`${baseUrl}/api/liff/v1/mini-app/${miniAppId}`)

  if (res.status === 404 || !res.ok) {
    return { miniApp: null, allowed: false, restPath: '', search: search ?? '' }
  }

  const miniApp: MiniAppData = await res.json()

  if (!miniApp.isPublished) {
    return { miniApp, allowed: false, restPath: '', search: search ?? '' }
  }

  const restPath = Array.isArray(rest) ? rest.join('/') : (rest ?? '')

  return { miniApp, allowed: true, restPath, search: search ?? '' }
}

export default function MiniAppPathSuffixPage() {
  const data = useLoader(loader)
  const { miniApp, allowed, restPath, search } = data

  if (miniApp === null) {
    return (
      <div style={{ padding: 32, textAlign: 'center' }}>
        <h2>Mini App not found</h2>
        <p>The Mini App you are looking for does not exist.</p>
      </div>
    )
  }

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

  const forwardPath =
    '/' + restPath + (search ? (search.startsWith('?') ? search : '?' + search) : '')

  return <MiniAppShell miniApp={miniApp} forwardPath={forwardPath} />
}
