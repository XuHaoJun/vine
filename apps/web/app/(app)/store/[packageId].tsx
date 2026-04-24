import { useActiveParams } from 'one'
import { PackageDetail } from '~/features/sticker-market/PackageDetail'

export default function Page() {
  const { packageId } = useActiveParams<{ packageId: string }>()
  return <PackageDetail packageId={packageId ?? ''} />
}
