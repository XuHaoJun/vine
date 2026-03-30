import { TransportProvider } from '@connectrpc/connect-query'
import { createConnectTransport } from '@connectrpc/connect-web'
import type { ReactNode } from 'react'
import { SERVER_URL } from '~/constants/urls'
import { QueryClientProvider, queryClient } from '~/query'

const transport = createConnectTransport({ baseUrl: SERVER_URL })

export function PlatformSpecificRootProvider(props: { children: ReactNode }) {
  return (
    <TransportProvider transport={transport}>
      <QueryClientProvider client={queryClient}>
        {props.children}
      </QueryClientProvider>
    </TransportProvider>
  )
}
