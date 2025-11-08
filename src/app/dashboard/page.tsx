"use client";

import { useState } from "react";
import useSWR from "swr";

interface WebsiteMeta {
  pages: number;
  scripts: number;
  seoScore: number;
  title: string;
  description: string;
}

interface Website {
  id: string;
  name: string;
  status: "uploaded" | "analyzed" | "deployed" | "failed";
  deployUrl?: string;
  userEmail: string;
  meta: WebsiteMeta;
  createdAt: string;
}

interface WebsitesResponse {
  websites: Website[];
}

const fetcher = (url: string) => fetch(url).then((res) => res.json() as Promise<WebsitesResponse>);

const statusStyles: Record<Website["status"], string> = {
  uploaded: "bg-zinc-800 text-zinc-100",
  analyzed: "bg-blue-500/20 text-blue-200",
  deployed: "bg-emerald-500/20 text-emerald-200",
  failed: "bg-rose-500/20 text-rose-200",
};

export default function DashboardPage() {
  const { data, error, isLoading, mutate } = useSWR<WebsitesResponse>("/api/websites", fetcher, {
    refreshInterval: 30000,
  });
  const [deployingId, setDeployingId] = useState<string | null>(null);

  const triggerDeploy = async (siteId: string) => {
    try {
      setDeployingId(siteId);
      const response = await fetch(`/api/deploy/${siteId}`, { method: "POST" });
      if (!response.ok) {
        console.error("Failed to trigger deploy", await response.text());
      }
      await mutate();
    } catch (deployError) {
      console.error("Deploy request failed", deployError);
    } finally {
      setDeployingId(null);
    }
  };

  return (
    <main className="min-h-screen bg-neutral-950 px-6 py-20">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-12">
        <header className="flex flex-col gap-3 text-left">
          <p className="text-sm uppercase tracking-[0.3em] text-zinc-500">Dashboard</p>
          <h1 className="text-4xl font-semibold text-white">Your uploaded sites</h1>
          <p className="max-w-2xl text-zinc-400">
            Monitor analysis scores, deployment status, and jump straight to your live Pages
            instance once it is ready.
          </p>
        </header>

        {isLoading && (
          <div className="grid gap-6 sm:grid-cols-2">
            {Array.from({ length: 4 }).map((_, index) => (
              <div
                key={index}
                className="h-48 animate-pulse rounded-2xl border border-white/5 bg-white/5"
              />
            ))}
          </div>
        )}

        {error && (
          <div className="rounded-2xl border border-rose-500/40 bg-rose-500/10 p-6 text-rose-100">
            Failed to load websites. Please refresh the page.
          </div>
        )}

        {data && data.websites.length === 0 && !isLoading && (
          <div className="rounded-2xl border border-white/10 bg-white/5 p-10 text-center text-zinc-300">
            You have not uploaded any websites yet. Start by uploading a .zip via the API.
          </div>
        )}

        {data && data.websites.length > 0 && (
          <section className="grid gap-6 sm:grid-cols-2">
            {data.websites.map((site) => (
              <article
                key={site.id}
                className="flex h-full flex-col justify-between rounded-3xl border border-white/10 bg-white/[0.04] p-6 backdrop-blur"
              >
                <div className="flex flex-col gap-4">
                  <div className="flex items-center justify-between gap-4">
                    <h2 className="text-xl font-semibold text-white">{site.name}</h2>
                    <span className={`rounded-full px-3 py-1 text-xs font-semibold ${statusStyles[site.status]}`}>
                      {site.status.toUpperCase()}
                    </span>
                  </div>
                  <p className="text-sm text-zinc-400">
                    Uploaded {new Date(site.createdAt).toLocaleString()}
                  </p>
                  <div className="grid grid-cols-3 gap-4 text-center">
                    <div className="rounded-2xl border border-white/10 bg-black/40 p-4">
                      <p className="text-xs uppercase text-zinc-500">SEO Score</p>
                      <p className="mt-2 text-2xl font-semibold text-white">{site.meta.seoScore}</p>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-black/40 p-4">
                      <p className="text-xs uppercase text-zinc-500">Pages</p>
                      <p className="mt-2 text-2xl font-semibold text-white">{site.meta.pages}</p>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-black/40 p-4">
                      <p className="text-xs uppercase text-zinc-500">Scripts</p>
                      <p className="mt-2 text-2xl font-semibold text-white">{site.meta.scripts}</p>
                    </div>
                  </div>
                  {site.meta.description && (
                    <p className="text-sm text-zinc-300">{site.meta.description}</p>
                  )}
                </div>

                <div className="mt-6 flex items-center justify-between">
                  {site.deployUrl ? (
                    <a
                      href={site.deployUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-sm font-medium text-blue-300 transition hover:text-blue-200"
                    >
                      Open deployment ↗
                    </a>
                  ) : (
                    <span className="text-sm text-zinc-500">Not deployed yet</span>
                  )}
                  <button
                    type="button"
                    onClick={() => triggerDeploy(site.id)}
                    disabled={deployingId === site.id}
                    className="rounded-full border border-blue-500/40 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-blue-200 transition hover:bg-blue-500/10 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {deployingId === site.id ? "Deploying..." : "Trigger Deploy"}
                  </button>
                </div>
              </article>
            ))}
          </section>
        )}
      </div>
    </main>
  );
}
