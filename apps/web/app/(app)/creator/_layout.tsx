import { Redirect } from 'one'
import { CreatorShell } from '~/features/sticker-market/creator/CreatorShell'
import { useAuth } from '~/features/auth/client/authClient'

export default function CreatorLayout() {
  const { state } = useAuth()
  if (state === 'logged-out') return <Redirect href="/auth/login" />
  return <CreatorShell />
}
