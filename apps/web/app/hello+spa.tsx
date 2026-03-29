import { createConnectTransport } from '@connectrpc/connect-web'
import { createClient } from '@connectrpc/connect'
import { GreeterService } from '@vine/proto/greeter'
import { useState } from 'react'
import { Button, Input, SizableText, YStack, XStack } from 'tamagui'

const transport = createConnectTransport({
  baseUrl: (import.meta.env.VITE_SERVER_URL as string | undefined) ?? 'http://localhost:3001',
})

const client = createClient(GreeterService, transport)

export default function HelloPage() {
  const [name, setName] = useState('')
  const [message, setMessage] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function sayHello() {
    if (!name.trim()) return
    setLoading(true)
    setError(null)
    setMessage(null)
    try {
      const res = await client.sayHello({ name: name.trim() })
      setMessage(res.message)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
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
        <Input
          flex={1}
          placeholder="Your name"
          value={name}
          onChangeText={setName}
          onSubmitEditing={sayHello}
        />
        <Button
          theme="accent"
          onPress={sayHello}
          disabled={loading || !name.trim()}
        >
          {loading ? '...' : 'Say Hello'}
        </Button>
      </XStack>

      {message && (
        <SizableText size="$5" fontWeight="600" color="$green10">
          {message}
        </SizableText>
      )}

      {error && (
        <SizableText size="$4" color="$red10">
          Error: {error}
        </SizableText>
      )}
    </YStack>
  )
}
