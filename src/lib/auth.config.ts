import type { NextAuthConfig } from "next-auth";
import Email from "next-auth/providers/email";
import GitHub from "next-auth/providers/github";
import Google from "next-auth/providers/google";

const providers: NextAuthConfig["providers"] = [];

if (process.env.GITHUB_ID && process.env.GITHUB_SECRET) {
  providers.push(
    GitHub({
      clientId: process.env.GITHUB_ID!,
      clientSecret: process.env.GITHUB_SECRET!,
    }),
  );
}

if (process.env.GOOGLE_ID && process.env.GOOGLE_SECRET) {
  providers.push(
    Google({
      clientId: process.env.GOOGLE_ID!,
      clientSecret: process.env.GOOGLE_SECRET!,
    }),
  );
}

if (process.env.NODE_ENV === "development" || providers.length === 0) {
  providers.push(
    Email({
      server: process.env.EMAIL_SERVER ?? "smtp://user:pass@smtp.localhost:587",
      from: process.env.EMAIL_FROM ?? "noreply@afterweb.dev",
    }),
  );
}

export const authConfig = {
  secret: process.env.NEXTAUTH_SECRET,
  providers,
  callbacks: {
    async session({ session }) {
      if (!session?.user?.email && process.env.DEMO_USER_EMAIL) {
        session.user = {
          email: process.env.DEMO_USER_EMAIL,
          name: "Demo User",
          image: "https://avatars.githubusercontent.com/u/00000000?v=4",
        };
      }
      return session;
    },
    async signIn({ user }) {
      if (!user?.email && process.env.DEMO_USER_EMAIL) {
        user.email = process.env.DEMO_USER_EMAIL;
        return true;
      }
      return true;
    },
  },
} satisfies NextAuthConfig;
