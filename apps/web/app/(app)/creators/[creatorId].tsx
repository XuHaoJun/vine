import { useActiveParams, createRoute } from 'one'
import { CreatorPublicPage } from '~/features/sticker-market/CreatorPublicPage'

const route = createRoute<'/(app)/creators/[creatorId]'>()

export default function Page() {
  const { creatorId } = useActiveParams<{ creatorId: string }>()
  return <CreatorPublicPage creatorId={creatorId ?? ''} />
}
