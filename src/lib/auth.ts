import { getServerSession } from "next-auth";

export async function getSessionUserEmail(): Promise<string | null> {
  try {
    const session = await getServerSession();
    const email = session?.user?.email;
    if (typeof email === "string" && email.length > 0) {
      return email;
    }
  } catch (error) {
    console.warn("Failed to resolve server session", error);
  }
  return null;
}
