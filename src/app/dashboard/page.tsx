"use client";
import { useEffect, useState } from "react";

type Website = {
  _id?: string;
  id?: string;
  name: string;
  status: string;
  deployUrl?: string;
  meta?: { seoScore?: number };
};

type WebsitesResponse = { websites?: Website[] } | Website[];

function normalizeSites(data: WebsitesResponse): Website[] {
  if (Array.isArray(data)) {
    return data;
  }

  if (Array.isArray(data?.websites)) {
    return data.websites;
  }

  return [];
}

function getSiteId(site: Website) {
  return site._id ?? site.id ?? "unknown";
}

export default function Dashboard() {
  const [sites, setSites] = useState<Website[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState("");

  async function fetchSites() {
    const res = await fetch("/api/websites");
    const data = (await res.json()) as WebsitesResponse;
    setSites(normalizeSites(data));
  }

  async function handleUpload() {
    if (!file) return;
    setUploading(true);
    const form = new FormData();
    form.append("file", file);
    form.append("userEmail", "demo@afterweb.dev");

    const res = await fetch("/api/upload", { method: "POST", body: form });
    const data = await res.json();
    setUploading(false);
    setMessage(data.message || data.error || "");
    fetchSites();
  }

  useEffect(() => {
    fetchSites();
  }, []);

  return (
    <div className="min-h-screen bg-gray-950 text-white p-8">
      <h1 className="text-3xl font-bold mb-6">Your Uploaded Sites</h1>
      <p className="text-gray-400 mb-8">
        Upload a .zip folder of your static website (index.html required).
      </p>

      <div className="bg-gray-900 p-6 rounded-xl border border-gray-800 mb-10">
        <input
          type="file"
          accept=".zip"
          onChange={(e) => setFile(e.target.files?.[0] || null)}
          className="mb-4 block text-white"
        />
        <button
          onClick={handleUpload}
          disabled={uploading}
          className="px-4 py-2 bg-blue-500 rounded-lg hover:bg-blue-600 disabled:opacity-50"
        >
          {uploading ? "Uploading..." : "Upload .zip"}
        </button>
        {message && <p className="mt-3 text-sm text-gray-400">{message}</p>}
      </div>

      {sites.length === 0 ? (
        <div className="p-6 bg-gray-900 rounded-xl text-gray-400 border border-gray-800">
          You have not uploaded any websites yet. Start by uploading a .zip via the form above.
        </div>
      ) : (
        <div className="grid gap-4">
          {sites.map((site) => (
            <div key={getSiteId(site)} className="p-4 bg-gray-900 rounded-xl border border-gray-800">
              <h2 className="text-xl font-semibold">{site.name}</h2>
              <p>Status: {site.status}</p>
              <p>SEO Score: {site.meta?.seoScore ?? "N/A"}</p>
              {site.deployUrl && (
                <a href={site.deployUrl} target="_blank" className="text-blue-400 underline">
                  View Site
                </a>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
