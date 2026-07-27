import NextAuth, { AuthOptions, SessionStrategy } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import GoogleProvider from 'next-auth/providers/google';
import AppleProvider from 'next-auth/providers/apple';
import { PrismaAdapter } from '@auth/prisma-adapter';
import { prisma } from '@car-rental/db/client';
import { comparePassword, hashPassword } from './password';
import { getEnv } from '@car-rental/core/config';
import { logger } from '@car-rental/core/logging';

const { AUTH_SECRET, AUTH_URL, NODE_ENV } = getEnv();

export const authConfig: AuthOptions = {
  adapter: PrismaAdapter(prisma),
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error('Email and password required');
        }

        const user = await prisma.user.findUnique({
          where: { email: credentials.email },
          include: { customer: true, staff: true },
        });

        if (!user || !user.passwordHash) {
          throw new Error('Invalid credentials');
        }

        const isValid = await comparePassword(credentials.password, user.passwordHash);
        if (!isValid) {
          throw new Error('Invalid credentials');
        }

        if (user.status !== 'ACTIVE') {
          throw new Error('Account is suspended');
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          customerId: user.customer?.id,
          staffId: user.staff?.id,
        };
      },
    }),
    GoogleProvider({
      clientId: getEnv().GOOGLE_CLIENT_ID!,
      clientSecret: getEnv().GOOGLE_CLIENT_SECRET!,
    }),
    AppleProvider({
      clientId: getEnv().APPLE_CLIENT_ID!,
      clientSecret: getEnv().APPLE_CLIENT_SECRET!,
    }),
  ],
  session: {
    strategy: 'jwt' as SessionStrategy,
    maxAge: 30 * 24 * 60 * 60,
  },
  callbacks: {
    async jwt({ token, user, account }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
        token.customerId = (user as any).customerId;
        token.staffId = (user as any).staffId;
      }
      if (account?.provider === 'google' || account?.provider === 'apple') {
        const dbUser = await prisma.user.findUnique({ where: { email: token.email! }, include: { customer: true, staff: true } });
        if (dbUser) {
          token.id = dbUser.id;
          token.role = dbUser.role;
          token.customerId = dbUser.customer?.id;
          token.staffId = dbUser.staff?.id;
        }
      }
      return token;
    },
    async session({ session, token }) {
      session.user.id = token.id;
      session.user.role = token.role;
      session.user.customerId = token.customerId;
      session.user.staffId = token.staffId;
      return session;
    },
    async signIn({ user, account }) {
      if (account?.provider === 'google' || account?.provider === 'apple') {
        const existingUser = await prisma.user.findUnique({ where: { email: user.email! } });
        if (!existingUser) {
          await prisma.user.create({
            data: {
              email: user.email!,
              name: user.name,
              emailVerified: new Date(),
              role: 'CUSTOMER',
            },
          });
        }
      }
      return true;
    },
  },
  pages: {
    signIn: '/auth/signin',
    signUp: '/auth/signup',
    error: '/auth/error',
  },
  secret: AUTH_SECRET,
  debug: NODE_ENV === 'development',
  logger: {
    error: (code, ...message) => logger.error({ code, message }, 'Auth error'),
    warn: (code, ...message) => logger.warn({ code, message }, 'Auth warning'),
    debug: (code, ...message) => logger.debug({ code, message }, 'Auth debug'),
  },
};

export const { handlers, auth, signIn, signOut } = NextAuth(authConfig);

export async function createUser(email: string, password: string, name?: string) {
  const passwordHash = await hashPassword(password);
  return prisma.user.create({
    data: { email, passwordHash, name, role: 'CUSTOMER' },
  });
}