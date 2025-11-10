import { getServerSession } from "next-auth";
import type { Session } from "next-auth";

import { authConfig } from "./auth.config";

export async function getSessionUserEmail(): Promise<string | null> {
  try {
    const session: Session | null = await getServerSession(authConfig);
    const email = session?.user?.email;
    if (email) {
      return email;
    }

    if (process.env.DEMO_USER_EMAIL) {
      return process.env.DEMO_USER_EMAIL;
    }

    return null;
  } catch {
    if (process.env.DEMO_USER_EMAIL) {
      return process.env.DEMO_USER_EMAIL;
    }

    return null;
  }
}
