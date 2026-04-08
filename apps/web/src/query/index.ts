export {
  QueryClient,
  QueryClientProvider,
  useMutation as useTanMutation,
  useQuery as useTanQuery,
  useInfiniteQuery as useTanInfiniteQuery,
  useQueryClient as useTanQueryClient,
} from '@tanstack/react-query'

import { QueryClient } from '@tanstack/react-query'

export const queryClient = new QueryClient()
