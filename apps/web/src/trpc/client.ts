import { createTRPCReact } from '@trpc/react-query';
import type { AppRouter } from '@car-rental/api-contracts/routers';

export const trpc = createTRPCReact<AppRouter>();

export function createTRPCClient() {
  return trpc.createClient({
    links: [
      httpBatchLink({
        url: '/api/trpc',
        headers() {
          return { 'x-trpc-source': 'web' };
        },
      }),
    ],
  });
}