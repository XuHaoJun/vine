export {
  QueryClient,
  QueryClientProvider,
  useMutation as useTanMutation,
  useQuery as useTanQuery,
  useInfiniteQuery as useTanInfiniteQuery,
  useQueryClient as useTanQueryClient,
} from '@tanstack/react-query'

export {
  useMutation as useConnectMutation,
  useQuery as useConnectQuery,
} from '@connectrpc/connect-query'

import { QueryClient } from '@tanstack/react-query'

export const queryClient = new QueryClient()
