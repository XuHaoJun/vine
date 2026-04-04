import { forwardRef } from 'react'
import {
  Input as TamaguiInput,
  styled,
  type GetProps,
  type TamaguiElement,
  SizableText,
  YStack,
} from 'tamagui'

const StyledInput = styled(TamaguiInput, {
  borderWidth: 0.5,
  placeholderTextColor: '$color8',
  size: '$4',
  width: '100%',

  focusVisibleStyle: {
    outlineWidth: 3,
    outlineStyle: 'solid',
    outlineColor: '$background04',
    outlineOffset: 1,
    borderWidth: 0.5,
    borderColor: '$color5',
  },

  variants: {
    hasError: {
      true: {
        borderColor: '$red7',
        focusVisibleStyle: {
          borderColor: '$red9',
          outlineColor: '$red4',
        },
      },
    },
  } as const,
})

export type InputProps = GetProps<typeof StyledInput> & {
  error?: string | undefined
}

export const Input = forwardRef<TamaguiElement, InputProps>(
  ({ error, flex, ...props }, ref) => {
    return (
      <YStack gap="$2" flex={flex} width="100%">
        <StyledInput ref={ref} hasError={!!error} {...props} />
        {error && (
          <SizableText size="$2" color="$red9">
            {error}
          </SizableText>
        )}
      </YStack>
    )
  },
)

Input.displayName = 'Input'
