import { useActiveParams, createRoute } from 'one'
import { PackageDetail } from '~/features/sticker-market/PackageDetail'

const route = createRoute<'/(app)/store/[packageId]'>()

export default function Page() {
  const { packageId } = useActiveParams<{ packageId: string }>()
  return <PackageDetail packageId={packageId ?? ''} />
}
