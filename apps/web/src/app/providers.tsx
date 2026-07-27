'use client';

import { SessionProvider } from 'next-auth/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { TRPCReactProvider } from '@car-rental/api-contracts/trpc';
import { useState } from 'react';

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: { staleTime: 60_000, refetchOnWindowFocus: false },
    },
  }));
  const [trpcClient] = useState(() => createTRPCClient());

  return (
    <SessionProvider>
      <QueryClientProvider client={queryClient}>
        <TRPCReactProvider client={trpcClient} queryClient={queryClient}>
          {children}
        </TRPCReactProvider>
      </QueryClientProvider>
    </SessionProvider>
  );
}