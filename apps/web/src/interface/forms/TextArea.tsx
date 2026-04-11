import { TextArea as TamaguiTextArea } from '@tamagui/input'
import { forwardRef } from 'react'
import { styled, type GetProps, type TamaguiElement, SizableText, YStack } from 'tamagui'

const StyledTextArea = styled(TamaguiTextArea, {
  borderWidth: 0.5,
  placeholderTextColor: '$color8',
  size: '$4',
  width: '100%',
  flex: 1,
  minH: 280,
  textAlignVertical: 'top',

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

export type TextAreaProps = GetProps<typeof StyledTextArea> & {
  error?: string | undefined
}

export const TextArea = forwardRef<TamaguiElement, TextAreaProps>(
  ({ error, flex, ...props }, ref) => {
    return (
      <YStack gap="$2" flex={flex} width="100%">
        <StyledTextArea ref={ref} hasError={!!error} {...props} />
        {error && (
          <SizableText size="$2" color="$red9">
            {error}
          </SizableText>
        )}
      </YStack>
    )
  },
)

TextArea.displayName = 'TextArea'
