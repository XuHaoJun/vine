import { TransportProvider } from '@connectrpc/connect-query'
import type { ReactNode } from 'react'
import { connectTransport } from '~/features/auth/client/connectTransport'
import { QueryClientProvider, queryClient } from '~/query'

export function PlatformSpecificRootProvider(props: { children: ReactNode }) {
  return (
    <TransportProvider transport={connectTransport}>
      <QueryClientProvider client={queryClient}>{props.children}</QueryClientProvider>
    </TransportProvider>
  )
}
