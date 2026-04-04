import { router } from 'one'
import { memo } from 'react'
import { ListItem, ScrollView, SizableText, XStack, YStack } from 'tamagui'

import { useLogout } from '~/features/auth/useLogout'
import { Button } from '~/interface/buttons/Button'
import { CaretLeftIcon } from '~/interface/icons/phosphor/CaretLeftIcon'
import { DoorIcon } from '~/interface/icons/phosphor/DoorIcon'
import { GearIcon } from '~/interface/icons/phosphor/GearIcon'

export const SettingsPage = memo(() => {
  const { logout } = useLogout()

  const handleLogout = () => {
    void logout()
  }

  const handleBack = () => {
    router.back()
  }

  return (
    <YStack flex={1} bg="$background">
      {/* Header */}
      <XStack px="$4" py="$3" items="center" gap="$3">
        <Button
          variant="transparent"
          circular
          onPress={handleBack}
          icon={<CaretLeftIcon size={24} />}
          aria-label="Back"
        />
        <SizableText size="$5" fontWeight="700" color="$color12">
          設定
        </SizableText>
      </XStack>

      <ScrollView>
        {/* Settings Section */}
        <YStack px="$4" py="$2">
          <SizableText size="$4" fontWeight="700" color="$color12" mb="$3">
            一般
          </SizableText>

          <ListItem
            py="$3"
            cursor="pointer"
            icon={<GearIcon size={24} />}
            title="Account"
            subTitle="Manage your account settings"
            hoverStyle={{ bg: '$backgroundHover' }}
            onPress={() => {}}
          />
        </YStack>

        {/* Logout Section */}
        <YStack px="$4" py="$4">
          <ListItem
            py="$3"
            cursor="pointer"
            icon={<DoorIcon size={24} />}
            title="登出"
            subTitle="Log out of your account"
            hoverStyle={{ bg: '$backgroundHover' }}
            onPress={handleLogout}
          />
        </YStack>
      </ScrollView>
    </YStack>
  )
})

export default SettingsPage
