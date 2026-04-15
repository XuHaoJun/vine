import { memo } from 'react'
import { Select as TamaguiSelect } from 'tamagui'
import { SizableText, YStack } from 'tamagui'

export type SelectOption = { label: string; value: string }

export type SelectComponentProps = {
  value: string
  onValueChange: (value: string) => void
  options: SelectOption[]
  placeholder?: string
  error?: string | undefined
  'data-testid'?: string
}

export const Select = memo(
  ({
    value,
    onValueChange,
    options,
    placeholder = 'Select an option',
    error,
    'data-testid': dataTestid,
  }: SelectComponentProps) => {
    return (
      <YStack gap="$2" width="100%">
        <TamaguiSelect
          value={value}
          onValueChange={onValueChange}
          data-testid={dataTestid}
        >
          <TamaguiSelect.Trigger
            borderWidth={0.5}
            borderColor={error ? '$red7' : '$borderColor'}
            bg="$background"
            focusVisibleStyle={{
              outlineWidth: 3,
              outlineStyle: 'solid',
              outlineColor: '$background04',
              outlineOffset: 1,
              borderWidth: 0.5,
              borderColor: error ? '$red9' : '$color5',
            }}
          >
            <TamaguiSelect.Value placeholder={placeholder} />
          </TamaguiSelect.Trigger>

          <TamaguiSelect.Content>
            <TamaguiSelect.Viewport
              borderWidth={1}
              borderColor="$borderColor"
              bg="$background"
            >
              <TamaguiSelect.Group>
                {options.map((option, i) => (
                  <TamaguiSelect.Item key={option.value} value={option.value} index={i} data-testid={`${dataTestid}-${option.value}`}>
                    <TamaguiSelect.ItemText>{option.label}</TamaguiSelect.ItemText>
                    <TamaguiSelect.ItemIndicator />
                  </TamaguiSelect.Item>
                ))}
              </TamaguiSelect.Group>
            </TamaguiSelect.Viewport>
          </TamaguiSelect.Content>
        </TamaguiSelect>
        {error && (
          <SizableText size="$2" color="$red9">
            {error}
          </SizableText>
        )}
      </YStack>
    )
  },
)

Select.displayName = 'Select'
