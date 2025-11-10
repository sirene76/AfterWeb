"use client";
import { useEffect, useRef, useState, DragEvent } from "react";

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
  const [dragActive, setDragActive] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState("");
  const [messageTone, setMessageTone] = useState<"success" | "error" | "warning" | "info" | "">("");
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const dragDepthRef = useRef(0);

  async function fetchSites() {
    try {
      const res = await fetch("/api/websites");
      if (!res.ok) {
        throw new Error("Failed to fetch sites");
      }
      const data = (await res.json()) as WebsitesResponse;
      setSites(normalizeSites(data));
    } catch (error) {
      console.error("Failed to load sites", error);
    }
  }

  function showMessage(text: string, tone: "success" | "error" | "warning" | "info" | "") {
    setMessage(text);
    setMessageTone(tone);
  }

  async function handleUpload(selectedFile?: File) {
    if (uploading) return;
    const uploadFile = selectedFile ?? file;
    if (!uploadFile) {
      showMessage("⚠️ Please select a .zip file.", "warning");
      return;
    }
    if (!uploadFile.name.toLowerCase().endsWith(".zip")) {
      showMessage("⚠️ Only .zip files are supported.", "warning");
      return;
    }

    setFile(uploadFile);
    setUploading(true);
    setUploadProgress(0);
    showMessage("", "");

    const progressTimer = window.setInterval(() => {
      setUploadProgress((prev) => {
        if (prev === null) return 0;
        if (prev >= 90) return prev;
        return Math.min(prev + Math.random() * 15, 90);
      });
    }, 200);

    const form = new FormData();
    form.append("file", uploadFile);
    form.append("userEmail", "demo@afterweb.dev");

    try {
      const res = await fetch("/api/upload", { method: "POST", body: form });
      const data = await res.json();

      if (res.ok) {
        setUploadProgress(100);
        showMessage(data.message || "✅ Upload successful!", "success");
        await fetchSites();
      } else {
        setUploadProgress(null);
        showMessage(`❌ ${data.error || "Upload failed."}`, "error");
      }
    } catch (error) {
      console.error("Upload failed", error);
      setUploadProgress(null);
      showMessage("❌ Upload failed — check console for details.", "error");
    } finally {
      window.clearInterval(progressTimer);
      setUploading(false);
      setFile(null);
      setTimeout(() => setUploadProgress(null), 400);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  }

  useEffect(() => {
    fetchSites();
  }, []);

  function handleDragEnter(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    event.stopPropagation();
    dragDepthRef.current += 1;
    if (!dragActive) {
      setDragActive(true);
    }
  }

  function handleDragOver(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    event.stopPropagation();
    if (!dragActive) {
      setDragActive(true);
    }
  }

  function handleDragLeave(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    event.stopPropagation();
    dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);
    if (dragDepthRef.current === 0) {
      setDragActive(false);
    }
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    event.stopPropagation();
    dragDepthRef.current = 0;
    setDragActive(false);

    const droppedFile = event.dataTransfer.files?.[0];
    if (!droppedFile) return;
    if (!droppedFile.name.toLowerCase().endsWith(".zip")) {
      showMessage("⚠️ Please drop a .zip file.", "warning");
      return;
    }
    handleUpload(droppedFile);
  }

  function openFileDialog() {
    if (!uploading) {
      fileInputRef.current?.click();
    }
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white p-8">
      <h1 className="text-3xl font-bold mb-6">Your Uploaded Sites</h1>
      <p className="text-gray-400 mb-8">
        Upload a .zip folder of your static website (index.html required).
      </p>

      <div
        onClick={openFileDialog}
        onDragEnter={handleDragEnter}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`group relative mb-10 flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed p-10 text-center transition-all duration-200 ease-out focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 ${
          dragActive
            ? "border-blue-400 bg-blue-900/20 shadow-[0_0_0_3px_rgba(59,130,246,0.25)]"
            : "border-gray-800 bg-gray-900 hover:border-gray-600 hover:bg-gray-900/70"
        } ${uploading ? "pointer-events-none opacity-80" : ""}`}
        role="button"
        tabIndex={0}
      >
        <input
          ref={fileInputRef}
          id="file-upload"
          type="file"
          accept=".zip"
          className="hidden"
          onChange={(event) => {
            const selected = event.target.files?.[0] ?? null;
            if (!selected) {
              setFile(null);
              return;
            }
            if (!selected.name.toLowerCase().endsWith(".zip")) {
              showMessage("⚠️ Only .zip files are supported.", "warning");
              event.target.value = "";
              return;
            }
            setFile(selected);
            handleUpload(selected);
          }}
        />
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-blue-500/20 text-blue-400">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            className="h-6 w-6"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M3 15.75V19.5A1.5 1.5 0 0 0 4.5 21h15a1.5 1.5 0 0 0 1.5-1.5v-3.75M16.5 9 12 4.5 7.5 9m4.5-4.5V15"
            />
          </svg>
        </div>
        <p className="text-lg font-medium text-white">
          {dragActive ? "Drop your .zip file" : "Drag & drop your .zip here"}
        </p>
        <p className="mt-2 max-w-sm text-sm text-gray-400">
          or click below to browse files from your device
        </p>
        <button
          type="button"
          onClick={openFileDialog}
          className="mt-6 inline-flex items-center gap-2 rounded-lg bg-blue-500 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300"
        >
          {uploading ? (
            <svg
              className="h-4 w-4 animate-spin"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 0 1 8-8v4a4 4 0 0 0-4 4H4z"
              />
            </svg>
          ) : (
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              className="h-4 w-4"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
          )}
          <span>{uploading ? "Uploading" : "Upload .zip"}</span>
        </button>

        {file && !uploading && (
          <p className="mt-4 text-sm text-gray-300">Selected: {file.name}</p>
        )}

        {uploadProgress !== null && (
          <div className="mt-6 flex w-full max-w-md flex-col items-center">
            <div className="h-2 w-full overflow-hidden rounded-full bg-gray-800">
              <div
                className="h-full rounded-full bg-blue-500 transition-all duration-200"
                style={{ width: `${uploadProgress}%` }}
              />
            </div>
            <span className="mt-2 text-xs text-gray-400">{Math.round(uploadProgress)}%</span>
          </div>
        )}
      </div>

      {message && (
        <p
          className={`mb-8 text-sm ${
            messageTone === "success"
              ? "text-emerald-400"
              : messageTone === "error"
              ? "text-red-400"
              : messageTone === "warning"
              ? "text-amber-300"
              : "text-gray-400"
          }`}
        >
          {message}
        </p>
      )}

      {sites.length === 0 ? (
        <div className="rounded-xl border border-gray-800 bg-gray-900 p-6 text-gray-400">
          You have not uploaded any websites yet. Start by uploading a .zip via the form above.
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
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
