import { type GetServerSidePropsContext } from "next";
import {
  getServerSession,
  type NextAuthOptions,
  type DefaultSession,
} from "next-auth";
import GitlabProvider from "next-auth/providers/gitlab";
import { prisma } from "~/server/db";
import CredentialsProvider from "next-auth/providers/credentials";
import { env } from "~/env.mjs";
import { PrismaAdapter } from "@next-auth/prisma-adapter";

/**
 * Module augmentation for `next-auth` types. Allows us to add custom properties to the `session`
 * object and keep type safety.
 *
 * @see https://next-auth.js.org/getting-started/typescript#module-augmentation
 */
declare module "next-auth" {
  interface Session extends DefaultSession {
    user: {
      id: string;
      // ...other properties
      // role: UserRole;
    } & DefaultSession["user"];
  }

  // interface User {
  //   // ...other properties
  //   // role: UserRole;
  // }
}

/**
 * Options for NextAuth.js used to configure adapters, providers, callbacks, etc.
 *
 * @see https://next-auth.js.org/configuration/options
 */
export const authOptions: NextAuthOptions = {
  providers: [
    // OAuth authentication providers...
    GitlabProvider({
      name: "Magenta CICD",
      clientId: env.GITLAB_CLIENT_ID,
      clientSecret: env.GITLAB_CLIENT_SECRET,

      authorization: {
        url: "https://gitlab.devops.telekom.de/oauth/authorize",
      },
      token: "https://gitlab.devops.telekom.de/oauth/token",
      userinfo: "https://gitlab.devops.telekom.de/api/v4/user",
      httpOptions: {
        timeout: 15_000,
      },
    }),
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        username: { label: "Username", type: "text", placeholder: "" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials, req) {
        if (
          credentials?.username === process.env.EMERGENCY_USERNAME &&
          credentials?.password === process.env.EMERGENCY_PASSWORD
        ) {
          const user = await prisma.user.findUnique({
            where: {
              email: credentials?.username,
            },
          });
          if (!user) {
            throw new Error("User not found");
          }
          console.debug(user);

          return user;
        }

        // login failed
        return null;
      },
    }),

  ],
  adapter: PrismaAdapter(prisma),
  session: {strategy: "jwt"},
};

/**
 * Wrapper for `getServerSession` so that you don't need to import the `authOptions` in every file.
 *
 * @see https://next-auth.js.org/configuration/nextjs
 */
export const getServerAuthSession = (ctx: {
  req: GetServerSidePropsContext["req"];
  res: GetServerSidePropsContext["res"];
}) => {
  return getServerSession(ctx.req, ctx.res, authOptions);
};
