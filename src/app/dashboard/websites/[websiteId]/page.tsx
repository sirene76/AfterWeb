import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import WebsiteDetailShell from "@/components/dashboard/WebsiteDetailShell";
import type { WebsiteDetailResponse } from "@/types/website-detail";

interface WebsiteDetailPageProps {
  params: { websiteId: string };
}

function resolveBaseUrl() {
  if (process.env.NEXT_PUBLIC_BASE_URL) {
    return process.env.NEXT_PUBLIC_BASE_URL;
  }
  if (process.env.NEXTAUTH_URL) {
    return process.env.NEXTAUTH_URL;
  }
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }
  return "http://localhost:3000";
}

async function fetchWebsiteDetail(
  websiteId: string,
  cookieHeader: string,
): Promise<WebsiteDetailResponse | null> {
  const baseUrl = resolveBaseUrl();
  const response = await fetch(`${baseUrl}/api/websites/${websiteId}/detail`, {
    cache: "no-store",
    headers: cookieHeader ? { Cookie: cookieHeader } : undefined,
  });

  if (!response.ok) {
    return null;
  }

  return (await response.json()) as WebsiteDetailResponse;
}

export default async function WebsiteDetailPage({ params }: WebsiteDetailPageProps) {
  const websiteId = params.websiteId;
  if (!websiteId) {
    redirect("/dashboard");
  }

  const cookieHeader = cookies().toString();
  const data = await fetchWebsiteDetail(websiteId, cookieHeader);
  if (!data?.ok || !data.website) {
    redirect("/dashboard");
  }

  return (
    <div className="mx-auto w-full max-w-6xl px-4 pb-12 pt-8">
      <WebsiteDetailShell website={data.website} latestReport={data.latestReport} logs={data.logs} />
    </div>
  );
}
