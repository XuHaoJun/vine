import { useActiveParams } from 'one'
import { CreatorPublicPage } from '~/features/sticker-market/CreatorPublicPage'

export default function Page() {
  const { creatorId } = useActiveParams<{ creatorId: string }>()
  return <CreatorPublicPage creatorId={creatorId ?? ''} />
}
