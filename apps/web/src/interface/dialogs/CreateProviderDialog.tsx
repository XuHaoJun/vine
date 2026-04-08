import { valibotResolver } from '@hookform/resolvers/valibot'
import { Controller, useForm } from 'react-hook-form'
import * as v from 'valibot'
import { AlertDialog, XStack, YStack } from 'tamagui'

import { Button } from '~/interface/buttons/Button'
import { Input } from '~/interface/forms/Input'

const fourByteUnicodeRegex = /[\u{10000}-\u{10FFFF}]/u

const schema = v.object({
  name: v.pipe(
    v.string(),
    v.minLength(1, "Don't leave this empty"),
    v.maxLength(100, 'Enter no more than 100 characters'),
    v.custom(
      (input) => !fourByteUnicodeRegex.test(String(input)),
      "Don't use special characters (4-byte Unicode)",
    ),
  ),
})

type FormData = v.InferInput<typeof schema>

export function CreateProviderDialog({
  open,
  onOpenChange,
  onSubmit,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (name: string) => void
}) {
  const {
    control,
    handleSubmit,
    reset,
    formState: { isSubmitting },
  } = useForm<FormData>({
    resolver: valibotResolver(schema),
    defaultValues: { name: '' },
  })

  const handleClose = (open: boolean) => {
    if (!open) {
      reset()
    }
    onOpenChange(open)
  }

  const handleFormSubmit = (data: FormData) => {
    onSubmit(data.name)
    reset()
    onOpenChange(false)
  }

  return (
    <AlertDialog open={open} onOpenChange={handleClose}>
      <AlertDialog.Portal>
        <AlertDialog.Overlay
          key="overlay"
          opacity={0.5}
          enterStyle={{ opacity: 0 }}
          exitStyle={{ opacity: 0 }}
        />
        <AlertDialog.Content
          bordered
          elevate
          key="content"
          enterStyle={{ x: 0, y: -20, opacity: 0, scale: 0.9 }}
          exitStyle={{ x: 0, y: 10, opacity: 0, scale: 0.95 }}
          x={0}
          scale={1}
          opacity={1}
          y={0}
          width="90%"
          maxW={400}
        >
          <YStack gap="$4">
            <AlertDialog.Title size="$6">Create Provider</AlertDialog.Title>

            <Controller
              control={control}
              name="name"
              render={({ field: { onChange, value }, fieldState: { error } }) => (
                <YStack gap="$2">
                  <Input
                    autoFocus
                    value={value}
                    onChangeText={onChange}
                    placeholder="Provider name"
                    error={error?.message}
                    onSubmitEditing={() => handleSubmit(handleFormSubmit)()}
                  />
                </YStack>
              )}
            />

            <XStack gap="$3" justify="flex-end">
              <Button onPress={() => handleClose(false)}>Cancel</Button>
              <Button
                theme="blue"
                onPress={handleSubmit(handleFormSubmit)}
                disabled={isSubmitting}
              >
                {isSubmitting ? 'Creating...' : 'Create'}
              </Button>
            </XStack>
          </YStack>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog>
  )
}
