import auth from "next-auth";
import { authConfig } from "./auth.config";

export async function getSessionUserEmail(): Promise<string | null> {
  try {
    const session = (await auth(authConfig)) as any; // ✅ new unified API

    const email = session?.user?.email;
    if (email) return email;

    // fallback for demo mode
    if (process.env.DEMO_USER_EMAIL) return process.env.DEMO_USER_EMAIL;

    return null;
  } catch (error) {
    console.warn("Failed to resolve session:", error);
    return process.env.DEMO_USER_EMAIL ?? null;
  }
}
