import { QueryClientProvider, queryClient } from '~/query'
import type { ReactNode } from 'react'

export function PlatformSpecificRootProvider(props: { children: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      {props.children as any}
    </QueryClientProvider>
  )
}
