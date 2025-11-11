import type { NextAuthConfig } from "next-auth";
import GitHub from "next-auth/providers/github";
import Credentials from "next-auth/providers/credentials";

const demoEmail = process.env.DEMO_USER_EMAIL ?? "demo@afterweb.dev";

const providers: NextAuthConfig["providers"] = [];

if (process.env.GITHUB_ID && process.env.GITHUB_SECRET) {
  providers.push(
    GitHub({
      clientId: process.env.GITHUB_ID,
      clientSecret: process.env.GITHUB_SECRET,
    }),
  );
}

providers.push(
  Credentials({
    name: "Demo",
    credentials: {},
    async authorize() {
      return {
        id: "demo-user",
        email: demoEmail,
        name: "Demo User",
      };
    },
  }),
);

export const authConfig = {
  secret: process.env.NEXTAUTH_SECRET,
  providers,
  callbacks: {
    async session({ session, token }) {
      const fallbackEmail = token?.email ?? demoEmail;

      if (!session.user) {
        session.user = {} as typeof session.user;
      }

      session.user = {
        ...session.user,
        email: session.user?.email ?? fallbackEmail,
        name: session.user?.name ?? "Demo User",
        image: session.user?.image ?? "https://avatars.githubusercontent.com/u/0?v=4",
      } as typeof session.user;

      (session.user as typeof session.user & { role?: string }).role = "user";

      return session;
    },
    async jwt({ token, user }) {
      if (user?.email) {
        token.email = user.email;
      } else if (!token.email) {
        token.email = demoEmail;
      }

      return token;
    },
  },
} satisfies NextAuthConfig;
