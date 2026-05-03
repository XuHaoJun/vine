import { useState } from 'react'
import { SizableText, XStack, YStack } from 'tamagui'
import { AccessTokenType } from '@vine/proto/oa'

import { oaClient } from '~/features/oa/client'
import { Button } from '~/interface/buttons/Button'
import { showToast } from '~/interface/toast/Toast'
import { useTanMutation, useTanQuery, useTanQueryClient } from '~/query'
import { createRoute } from 'one'

const route =
  createRoute<'/(app)/developers/console/channel/[channelId]/AccessTokenSection'>()

type Props = { channelId: string }

export function AccessTokenSection({ channelId }: Props) {
  const queryClient = useTanQueryClient()
  const [revealedToken, setRevealedToken] = useState<string | null>(null)

  const { data, isLoading } = useTanQuery({
    queryKey: ['oa', 'accessTokens', channelId],
    queryFn: () => oaClient.listAccessTokens({ officialAccountId: channelId }),
    enabled: !!channelId,
  })

  const issue = useTanMutation({
    mutationFn: () =>
      oaClient.issueAccessToken({
        officialAccountId: channelId,
        type: AccessTokenType.SHORT_LIVED,
      }),
    onSuccess: (res) => {
      setRevealedToken(res.accessToken)
      void queryClient.invalidateQueries({ queryKey: ['oa', 'accessTokens', channelId] })
    },
    onError: () => showToast('Failed to issue token', { type: 'error' }),
  })

  const revoke = useTanMutation({
    mutationFn: (tokenId: string) => oaClient.revokeAccessToken({ tokenId }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['oa', 'accessTokens', channelId] })
      showToast('Token revoked', { type: 'info' })
    },
    onError: () => showToast('Failed to revoke token', { type: 'error' }),
  })

  function handleCopy(token: string) {
    navigator.clipboard.writeText(token).then(
      () => showToast('Copied', { type: 'info' }),
      () => showToast('Copy failed', { type: 'error' }),
    )
  }

  return (
    <YStack gap="$3" p="$4" borderWidth={1} borderColor="$borderColor" rounded="$2">
      <XStack justify="space-between" items="center">
        <SizableText size="$5" fontWeight="700" color="$color12">
          Channel access token
        </SizableText>
        <Button size="$3" onPress={() => issue.mutate()} disabled={issue.isPending}>
          Issue
        </Button>
      </XStack>

      {revealedToken && (
        <YStack gap="$2" p="$3" bg="$color3" rounded="$2">
          <SizableText size="$2" color="$color10">
            Copy this token now — it won't be shown again.
          </SizableText>
          <XStack gap="$2" items="center" flexWrap="wrap">
            <SizableText size="$2" color="$color12" fontFamily="$mono" flex={1}>
              {revealedToken}
            </SizableText>
            <Button size="$2" onPress={() => handleCopy(revealedToken)}>
              Copy
            </Button>
            <Button size="$2" variant="outlined" onPress={() => setRevealedToken(null)}>
              OK
            </Button>
          </XStack>
        </YStack>
      )}

      {isLoading && (
        <SizableText size="$2" color="$color10">
          Loading...
        </SizableText>
      )}

      {data?.tokens.length === 0 && !isLoading && (
        <SizableText size="$2" color="$color10">
          No active tokens.
        </SizableText>
      )}

      {data?.tokens.map((t) => (
        <XStack
          key={t.id}
          justify="space-between"
          items="center"
          py="$2"
          px="$3"
          borderWidth={1}
          borderColor="$borderColor"
          rounded="$2"
        >
          <YStack gap="$1">
            <SizableText size="$2" color="$color12" fontWeight="500">
              {t.type === AccessTokenType.SHORT_LIVED ? 'Short-lived' : 'JWT v2.1'}
            </SizableText>
            <SizableText size="$1" color="$color10">
              Issued: {new Date(t.createdAt).toLocaleDateString()}
              {t.expiresAt
                ? `  ·  Expires: ${new Date(t.expiresAt).toLocaleDateString()}`
                : ''}
            </SizableText>
          </YStack>
          <Button
            size="$2"
            variant="outlined"
            onPress={() => revoke.mutate(t.id)}
            disabled={revoke.isPending}
          >
            Revoke
          </Button>
        </XStack>
      ))}
    </YStack>
  )
}
