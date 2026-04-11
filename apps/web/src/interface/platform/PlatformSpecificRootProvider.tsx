import type { ReactNode } from 'react'
import { QueryClientProvider, queryClient } from '~/query'

export function PlatformSpecificRootProvider(props: { children: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      {props.children as any}
    </QueryClientProvider>
  )
}
