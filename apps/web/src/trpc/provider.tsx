'use client';

import { createContext, useContext, ReactNode } from 'react';
import { TRPCReactProvider } from '@trpc/react-query';
import type { AppRouter } from '@car-rental/api-contracts/routers';
import { trpc } from './client';

const TRPCContext = createContext<ReturnType<typeof trpc.Provider> | null>(null);

export function TRPCReactProvider({ children, client, queryClient }: { children: ReactNode; client: ReturnType<typeof trpc.createClient>; queryClient: any }) {
  return (
    <trpc.Provider client={client} queryClient={queryClient}>
      {children}
    </trpc.Provider>
  );
}

export function useTRPC() {
  const context = useContext(TRPCContext);
  if (!context) throw new Error('useTRPC must be used within TRPCReactProvider');
  return context;
}