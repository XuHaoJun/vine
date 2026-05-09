import { SizableText, XStack } from 'tamagui'
import type { OfficialAccount } from '@vine/proto/oa'

type Props = {
  account: OfficialAccount
}

export function ManagerOAAccountSwitcher({ account }: Props) {
  return (
    <XStack items="center" gap="$2">
      <SizableText size="$3" fontWeight="700" color="$color12">
        {account.name}
      </SizableText>
      <SizableText size="$2" color="$color10">
        @{account.uniqueId}
      </SizableText>
    </XStack>
  )
}
