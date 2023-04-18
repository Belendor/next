import { type GetServerSidePropsContext } from "next";
import {
  getServerSession,
  type NextAuthOptions,
  type DefaultSession,
} from "next-auth";
import GitlabProvider from "next-auth/providers/gitlab";
import { PrismaAdapter } from "@next-auth/prisma-adapter";
import { env } from "~/env.mjs";
import { prisma } from "~/server/db";
import CredentialsProvider from "next-auth/providers/credentials"

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
  callbacks: {
    jwt: ({ token, user }) => {
      if(user) {
        token.id = user.id
      }
      return token
    },
    session: ({ session, user }) => ({
      ...session,
      user: {
        ...session.user,
        id: user.id,
      },
    }),
    // session: ({ session, token }) => ({
    //   if (token) {
    //     session.user.id = token.id
    //   }
    //   return session

    // }),
  },
  adapter: PrismaAdapter(prisma),
  providers: [
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
      // The name to display on the sign in form (e.g. 'Sign in with...')
      name: 'Credentials',
      // The credentials is used to generate a suitable form on the sign in page.
      // You can specify whatever fields you are expecting to be submitted.
      // e.g. domain, username, password, 2FA token, etc.
      // You can pass any HTML attribute to the <input> tag through the object.
      credentials: {
        username: { label: "Username", type: "text", placeholder: "" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials) { // req)
        // You need to provide your own logic here that takes the credentials
        // submitted and returns either a object representing a user or value
        // that is false/null if the credentials are invalid.
        // e.g. return { id: 1, name: 'J Smith', email: 'jsmith@example.com' }
        // You can also use the `req` object to obtain additional parameters
        // (i.e., the request IP address)

        if (credentials?.username === process.env.EMERGENCY_USERNAME && credentials?.password === process.env.EMERGENCY_PASSWORD) {

          const user = await prisma.user.findUnique({
            where: {
              email: credentials?.username,
            },
          });
          if (!user) {
            throw new Error("User not found");
          }

          return { 
            id: 2,
            name: 'Emergency User', // placeholder
            email: "emergency@email.com" // placeholder
          }
        }

        // login failed
        return null

        const res = await fetch("/your/endpoint", {
          method: 'POST',
          body: JSON.stringify(credentials),
          headers: { "Content-Type": "application/json" }
        })
        const user = await res.json()
  
        // If no error and we have user data, return it
        if (res.ok && user) {
          return user
        }
        // Return null if user data could not be retrieved
        return null
      }
    })
    /**
     * ...add more providers here.
     *
     * Most other providers require a bit more work than the Discord provider. For example, the
     * GitHub provider requires you to add the `refresh_token_expires_in` field to the Account
     * model. Refer to the NextAuth.js docs for the provider you want to use. Example:
     *
     * @see https://next-auth.js.org/providers/github
     */
  ],
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
