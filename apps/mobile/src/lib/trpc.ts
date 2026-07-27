import { createTRPCReact } from '@trpc/react-query';
import type { AppRouter } from '@car-rental/api-contracts/routers';

export const trpc = createTRPCReact<AppRouter>();

export function createTRPCClient() {
  return trpc.createClient({
    links: [
      httpBatchLink({
        url: 'http://localhost:3000/api/trpc',
        headers() {
          return { 'x-trpc-source': 'mobile' };
        },
      }),
    ],
  });
}