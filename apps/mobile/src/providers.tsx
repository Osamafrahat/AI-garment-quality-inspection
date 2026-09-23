'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { TRPCReactProvider } from '@threadsight/api-contracts/trpc';
import { createTRPCClient } from '../lib/trpc';
import { useState } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: { staleTime: 60_000, refetchOnWindowFocus: false },
    },
  }));
  const [trpcClient] = useState(() => createTRPCClient());

  return (
    <SafeAreaProvider>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <QueryClientProvider client={queryClient}>
          <TRPCReactProvider client={trpcClient} queryClient={queryClient}>
            {children}
          </TRPCReactProvider>
        </QueryClientProvider>
      </GestureHandlerRootView>
    </SafeAreaProvider>
  );
}
