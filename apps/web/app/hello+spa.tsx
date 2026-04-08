import { valibotResolver } from '@hookform/resolvers/valibot'
import { createClient } from '@connectrpc/connect'
import { GreeterService } from '@vine/proto/greeter'
import { Controller, useForm } from 'react-hook-form'
import * as v from 'valibot'
import { SizableText, YStack, XStack } from 'tamagui'
import { Button } from '~/interface/buttons/Button'
import { Input } from '~/interface/forms/Input'
import { useTanMutation } from '~/query'
import { connectTransport } from '~/features/auth/client/connectTransport'

const schema = v.object({
  name: v.pipe(v.string(), v.minLength(1, 'Name is required')),
})

type FormData = v.InferInput<typeof schema>

const greeterClient = createClient(GreeterService, connectTransport)

export default function HelloPage() {
  const { mutate, data, isPending, error } = useTanMutation({
    mutationFn: (input: { name: string }) => greeterClient.sayHello(input),
  })

  const { control, handleSubmit } = useForm<FormData>({
    resolver: valibotResolver(schema),
    defaultValues: { name: '' },
  })

  const onSubmit = (formData: FormData) => {
    mutate({ name: formData.name.trim() })
  }

  return (
    <YStack flex={1} items="center" justify="center" gap="$4" px="$6" maxW={480}>
      <SizableText size="$8" fontWeight="700">
        ConnectRPC Hello World
      </SizableText>

      <SizableText size="$3" color="$color10" text="center">
        This page calls the Fastify server&apos;s GreeterService via Connect Protocol.
      </SizableText>

      <XStack gap="$3" width="100%">
        <Controller
          control={control}
          name="name"
          render={({ field: { onChange, value }, fieldState: { error } }) => (
            <Input
              flex={1}
              placeholder="Your name"
              value={value}
              onChangeText={onChange}
              error={error?.message}
              onSubmitEditing={() => handleSubmit(onSubmit)()}
            />
          )}
        />
        <Button theme="accent" onPress={handleSubmit(onSubmit)} disabled={isPending}>
          {isPending ? '...' : 'Say Hello'}
        </Button>
      </XStack>

      {data?.message && (
        <SizableText size="$5" fontWeight="600" color="$green10">
          {data.message}
        </SizableText>
      )}

      {error && (
        <SizableText size="$4" color="$red10">
          Error: {error.message}
        </SizableText>
      )}
    </YStack>
  )
}
