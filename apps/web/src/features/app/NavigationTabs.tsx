import { Link, usePathname } from 'one'
import { useMedia, XStack } from 'tamagui'

import { Pressable } from '~/interface/buttons/Pressable'
import { ChatCircleIcon } from '~/interface/icons/phosphor/ChatCircleIcon'
import { GearIcon } from '~/interface/icons/phosphor/GearIcon'

import type { Href } from 'one'

type TabRoute = {
  name: string
  href: Href
  icon: any
}

const routes: TabRoute[] = [
  { name: 'talks', href: '/home/talks', icon: ChatCircleIcon },
  { name: 'settings', href: '/home/main', icon: GearIcon },
]

export function NavigationTabs() {
  const pathname = usePathname()
  const media = useMedia()
  const iconSize = media.sm ? 24 : 20

  const currentTab =
    routes.find((r) => pathname.startsWith(r.href as string))?.name ?? 'talks'

  return (
    <XStack gap="$2">
      {routes.map((route) => {
        const Icon = route.icon
        const isActive = currentTab === route.name
        return (
          <Link key={route.name} href={route.href}>
            <Pressable
              px="$4"
              py="$2"
              rounded="$4"
              bg={isActive ? '$color3' : 'transparent'}
              hoverStyle={{ bg: '$color2' }}
            >
              <Icon size={iconSize} color={isActive ? '$color12' : '$color10'} />
            </Pressable>
          </Link>
        )
      })}
    </XStack>
  )
}
