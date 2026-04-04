import { Slot } from 'one'

import { useSlotInitialRouteName } from '~/features/app/useSlotInitialRouteName'

import {
  TALKS_SLOT_BASE_PATH,
  TALKS_STACK_SCREEN_NAMES,
} from '~/features/chat/talks-config'

export default function TalksLayout() {
  const initialRouteName = useSlotInitialRouteName(
    TALKS_SLOT_BASE_PATH,
    TALKS_STACK_SCREEN_NAMES,
  )
  return <Slot {...(initialRouteName ? { initialRouteName } : {})} />
}
