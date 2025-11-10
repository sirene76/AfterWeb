// src/lib/auth.config.ts
import GitHub from "@auth/core/providers/github"; // or any provider you use
import Credentials from "@auth/core/providers/credentials";
import type { NextAuthConfig } from "next-auth";

export const authConfig = {
  providers: [
    GitHub({
      clientId: process.env.GITHUB_ID!,
      clientSecret: process.env.GITHUB_SECRET!,
    }),
    // or Credentials({...})
  ],
  secret: process.env.NEXTAUTH_SECRET,
} satisfies NextAuthConfig;
