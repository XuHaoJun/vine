import { SizableText, XStack } from 'tamagui'
import { ManagerOAAccountSwitcher } from '~/features/oa-manager/shared/ManagerOAAccountSwitcher'
import { Button } from '~/interface/buttons/Button'
import type { OfficialAccount } from '@vine/proto/oa'

type Props = {
  account: OfficialAccount | undefined
  onBack: () => void
}

export function AccountPageHeader({ account, onBack }: Props) {
  return (
    <XStack
      height="$6"
      px="$5"
      shrink={0}
      items="center"
      bg="$background"
      borderBottomWidth={1}
      borderColor="$borderColor"
      gap="$3"
    >
      <SizableText size="$4" fontWeight="700" color="$color12">
        Vine Official Account Manager
      </SizableText>
      {account ? <ManagerOAAccountSwitcher account={account} /> : null}
      <XStack flex={1} />
      <Button size="$2" variant="outlined" onPress={onBack}>
        Home
      </Button>
    </XStack>
  )
}
