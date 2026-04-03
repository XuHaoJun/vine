import { forwardRef } from 'react'
import {
  Input as TamaguiInput,
  styled,
  type GetProps,
  type TamaguiElement,
} from 'tamagui'

const StyledSearchInput = styled(TamaguiInput, {
  height: 36,
  bg: 'transparent',
  borderWidth: 0,
  size: '$5',
  outlineWidth: 0,

  focusVisibleStyle: {
    outlineWidth: 0,
    borderWidth: 0,
  },
})

export type SearchInputProps = GetProps<typeof StyledSearchInput>

export const SearchInput = forwardRef<TamaguiElement, SearchInputProps>(
  (props, ref) => {
    return <StyledSearchInput ref={ref} {...props} />
  },
)

SearchInput.displayName = 'SearchInput'
