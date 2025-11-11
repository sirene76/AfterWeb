import NextAuth from "next-auth";

import { authConfig } from "./auth.config";

export const { handlers, auth, signIn, signOut } = NextAuth(authConfig);

export async function getSessionUserEmail(): Promise<string | null> {
  try {
    const session = await auth();
    const email = session?.user?.email;

    if (email) {
      return email;
    }

    return process.env.DEMO_USER_EMAIL ?? "demo@afterweb.dev";
  } catch (error) {
    console.warn("Failed to resolve session:", error);
    return process.env.DEMO_USER_EMAIL ?? "demo@afterweb.dev";
  }
}
