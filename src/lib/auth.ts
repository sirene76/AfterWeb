import auth from "next-auth";
import { authConfig } from "./auth.config";

interface SessionUser {
  user?: {
    name?: string;
    email?: string;
    image?: string;
  };
}

export async function getSessionUserEmail(): Promise<string | null> {
  try {
    const session = (await auth(authConfig)) as SessionUser; // 👈 typed cast

    const email = session.user?.email;
    return typeof email === "string" && email.length > 0 ? email : null;
  } catch (error) {
    console.warn("Failed to resolve server session", error);
    return null;
  }
}
