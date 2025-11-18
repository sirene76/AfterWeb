import { cookies } from "next/headers";

function buildCookieHeader(): string {
  const cookieStore = cookies();
  const entries = cookieStore.getAll();
  return entries.map((entry) => `${entry.name}=${entry.value}`).join("; ");
}

export async function fetchAdminData<T>(path: string): Promise<T> {
  const baseUrl = process.env.NEXTAUTH_URL ?? "";
  const url = `${baseUrl}${path}`;
  const cookieHeader = buildCookieHeader();

  const response = await fetch(url, {
    cache: "no-store",
    headers: cookieHeader ? { cookie: cookieHeader } : undefined,
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch ${path}: ${response.status}`);
  }

  return response.json();
}
