import { Redirect } from 'one'
import { useAuth } from '~/features/auth/client/authClient'
import { CreatorShell } from '~/features/sticker-market/creator/CreatorShell'

export default function CreatorLayout() {
  const { state } = useAuth()
  if (state === 'logged-out') return <Redirect href="/auth/login" />
  return <CreatorShell />
}
