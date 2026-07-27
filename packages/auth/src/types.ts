import { DefaultSession, DefaultUser } from 'next-auth';
import { JWT, DefaultJWT } from 'next-auth/jwt';

declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      role: string;
      customerId?: string;
      staffId?: string;
    } & DefaultSession['user'];
  }

  interface User extends DefaultUser {
    role: string;
    customerId?: string;
    staffId?: string;
  }
}

declare module 'next-auth/jwt' {
  interface JWT extends DefaultJWT {
    id: string;
    role: string;
    customerId?: string;
    staffId?: string;
  }
}