import { useMutation } from '@connectrpc/connect-query'
import { GreeterService } from '@vine/proto/greeter'
import { useState } from 'react'
import { SizableText, YStack, XStack } from 'tamagui'
import { Button } from '~/interface/buttons/Button'
import { Input } from '~/interface/forms/Input'

export default function HelloPage() {
  const [name, setName] = useState('')

  const { mutate, data, isPending, error } = useMutation(GreeterService.method.sayHello)

  return (
    <YStack flex={1} items="center" justify="center" gap="$4" px="$6" maxW={480}>
      <SizableText size="$8" fontWeight="700">
        ConnectRPC Hello World
      </SizableText>

      <SizableText size="$3" color="$color10" text="center">
        This page calls the Fastify server&apos;s GreeterService via Connect Protocol.
      </SizableText>

      <XStack gap="$3" width="100%">
        <Input
          flex={1}
          placeholder="Your name"
          value={name}
          onChangeText={setName}
          onSubmitEditing={() => mutate({ name: name.trim() })}
        />
        <Button
          theme="accent"
          onPress={() => mutate({ name: name.trim() })}
          disabled={isPending || !name.trim()}
        >
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
