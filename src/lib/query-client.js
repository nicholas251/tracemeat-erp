import { QueryClient } from '@tanstack/react-query';


export const queryClientInstance = new QueryClient({
	defaultOptions: {
		queries: {
			// Ops data changes constantly across screens/users — keep the UI in sync by
			// always re-fetching on mount and when the tab/window regains focus, and treat
			// data as stale immediately so a change made anywhere shows up without a manual refresh.
			refetchOnWindowFocus: true,
			refetchOnMount: "always",
			retry: 1,
			staleTime: 0,
			gcTime: 5 * 60_000,       // keep unused cache for 5 min
		},
	},
});