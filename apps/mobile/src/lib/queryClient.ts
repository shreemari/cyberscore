import { QueryClient } from '@tanstack/react-query';

// Mobile defaults:
//   - 60s stale time so pull-to-refresh / back-to-foreground refetch is still
//     cheap but we don't hammer /scorecard on every screen focus.
//   - 2 retries with network-friendly backoff — mobile networks flap.
//   - refetchOnWindowFocus off (RN doesn't emit 'focus' the same way web does;
//     use refetchOnAppForeground via AppState listener if needed later).
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      gcTime: 5 * 60_000,
      retry: 2,
      retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 10_000),
      refetchOnReconnect: 'always',
    },
    mutations: {
      retry: 0,
    },
  },
});
