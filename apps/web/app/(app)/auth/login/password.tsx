import { valibotResolver } from '@hookform/resolvers/valibot'
import { router, useParams } from 'one'
import { Controller, useForm } from 'react-hook-form'
import { Keyboard } from 'react-native'
import * as v from 'valibot'
import { YStack } from 'tamagui'

import { passwordLogin } from '~/features/auth/client/passwordLogin'
import { Button } from '~/interface/buttons/Button'
import { showError } from '~/interface/dialogs/actions'
import { Input } from '~/interface/forms/Input'
import { PasswordIcon } from '~/interface/icons/phosphor/PasswordIcon'
import { KeyboardStickyFooter } from '~/interface/keyboard/KeyboardStickyFooter'
import { StepPageLayout } from '~/interface/pages/StepPageLayout'

const schema = v.object({
  password: v.pipe(v.string(), v.minLength(1, 'Password is required')),
})

type FormData = v.InferInput<typeof schema>

export const PasswordPage = () => {
  const params = useParams<{ value?: string }>()

  const {
    control,
    handleSubmit,
    formState: { isSubmitting },
  } = useForm<FormData>({
    resolver: valibotResolver(schema),
    defaultValues: { password: '' },
  })

  const displayValue = params.value || 'example@gmail.com'

  const onSubmit = async (data: FormData) => {
    if (!params.value) {
      showError('Email is not specified.')
      return
    }

    const { error } = await passwordLogin(params.value, data.password)

    if (error) {
      Keyboard.dismiss()
      showError(error)
      return
    }
    router.replace('/home')
  }

  return (
    <StepPageLayout
      title="Enter Password"
      Icon={PasswordIcon}
      description="Please enter the password for"
      descriptionSecondLine={displayValue}
      bottom={
        <KeyboardStickyFooter openedOffset={-10}>
          <Button
            data-testid="submit-password-button"
            size="$5"
            onPress={handleSubmit(onSubmit)}
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Verifying...' : 'Next'}
          </Button>
        </KeyboardStickyFooter>
      }
    >
      <YStack>
        <Controller
          control={control}
          name="password"
          render={({ field: { onChange, value }, fieldState: { error } }) => (
            <Input
              data-testid="password-input"
              type="password"
              autoFocus
              value={value}
              onChangeText={onChange}
              error={error?.message}
              onSubmitEditing={() => handleSubmit(onSubmit)()}
            />
          )}
        />
      </YStack>
    </StepPageLayout>
  )
}
