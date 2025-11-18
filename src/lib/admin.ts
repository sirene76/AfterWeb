import { getSessionUserEmail } from "@/lib/auth";

export async function requireAdmin(): Promise<string> {
  const email = await getSessionUserEmail();
  if (!email || email !== process.env.ADMIN_EMAIL) {
    throw new Error("NOT_ADMIN");
  }
  return email;
}
