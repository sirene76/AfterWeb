"use client";

import { DragEvent, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { generateReactHelpers } from "@uploadthing/react";
import Lottie from "lottie-react";

import type { OurFileRouter } from "@/app/api/uploadthing/core";

const { useUploadThing } = generateReactHelpers<OurFileRouter>();
import successAnim from "../../../public/lottie/success.json";

type MessageTone = "success" | "error" | "warning" | "info" | "";

type WebsiteMeta = {
  pages?: number;
  scripts?: number;
  seoScore?: number;
  title?: string;
  description?: string;
  faviconUrl?: string;
};

type MaintenanceEntry = {
  status: "success" | "fail";
  ranAt: string;
  details?: unknown;
} | null;

type WebsitePlan = "basic" | "standard" | "pro";
type WebsiteBillingStatus = "inactive" | "active" | "past_due" | "canceled";

type Website = {
  _id?: string;
  id?: string;
  name: string;
  status: string;
  deployUrl?: string;
  meta?: WebsiteMeta;
  maintenance?: {
    uptime: MaintenanceEntry;
    backup: MaintenanceEntry;
    seo: MaintenanceEntry;
  };
  lastCheck?: string | null;
  plan?: WebsitePlan;
  billingStatus?: WebsiteBillingStatus;
};

type WebsitesResponse = { websites?: Website[] } | Website[];

type UploadSummary = {
  siteId: string;
  meta: {
    title: string;
    description: string;
    faviconUrl?: string;
  };
};

const PLAN_LABELS: Record<WebsitePlan, string> = {
  basic: "Basic",
  standard: "Standard",
  pro: "Pro",
};

const BILLING_STATUS_LABELS: Record<WebsiteBillingStatus, string> = {
  inactive: "Inactive",
  active: "Active",
  past_due: "Past due",
  canceled: "Canceled",
};

function formatPlan(plan?: WebsitePlan) {
  const safePlan: WebsitePlan = plan ?? "basic";
  return PLAN_LABELS[safePlan];
}

function formatBillingStatus(status?: WebsiteBillingStatus) {
  const safeStatus: WebsiteBillingStatus = status ?? "inactive";
  return BILLING_STATUS_LABELS[safeStatus];
}

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
  const [messageTone, setMessageTone] = useState<MessageTone>("");
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [lastUploaded, setLastUploaded] = useState<UploadSummary | null>(null);
  const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const dragDepthRef = useRef(0);
  const messageTimeoutRef = useRef<number | null>(null);
  const verificationTimeoutsRef = useRef<number[]>([]);
  const refreshIntervalRef = useRef<number | null>(null);

const { startUpload, isUploading: uploadThingUploading, routeConfig } = useUploadThing(
  "websiteZip",
  {
    onClientUploadComplete: async (res) => {
        if (!res || res.length === 0 || !res[0]?.url) {
          showMessage("❌ Upload failed", "error");
          setUploadProgress(null);
          setUploading(false);
          return;
        }

        const fileUrl = res[0].url;
        setUploadProgress(60);
        showMessage("✅ Upload successful! Analyzing...", "info");

        try {
          const response = await fetch("/api/upload", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              fileUrl,
              userEmail: "demo@afterweb.dev",
            }),
          });

          const data = (await response.json()) as {
            siteId?: string;
            error?: string;
            meta?: { title?: string; description?: string; faviconUrl?: string };
            message?: string;
          };

          if (!response.ok) {
            showMessage(`❌ Analysis failed: ${data.error || "Unknown error"}`, "error");
            setUploadProgress(null);
            setUploading(false);
            return;
          }

          setUploadProgress(100);
          showMessage("✅ Analyzed and stored!", "success");

          const currentFile = file;
          setLastUploaded({
            siteId: data.siteId ?? "",
            meta: {
              title: data.meta?.title?.trim() || currentFile?.name.replace(/\.zip$/i, "") || "Uploaded Site",
              description: data.meta?.description?.trim() || "Your static site is ready!",
              faviconUrl: data.meta?.faviconUrl || "",
            },
          });

          await fetchSites();
          window.setTimeout(() => setUploadProgress(null), 800);
          setFile(null);
          if (fileInputRef.current) {
            fileInputRef.current.value = "";
          }
        } catch (error) {
          console.error(error);
          showMessage("❌ Analysis failed: Unknown error", "error");
          setUploadProgress(null);
        } finally {
          setUploading(false);
        }
      },
      onUploadError: (error) => {
        console.error(error);
        showMessage("❌ UploadThing error", "error");
        setUploadProgress(null);
        setUploading(false);
      },
    },
  );
  const isBusy = uploading || uploadThingUploading;
const maxUploadSize = routeConfig?.blob?.maxFileSize ?? "32MB";

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

  function renderMaintenanceStatus(label: string, entry?: MaintenanceEntry) {
    let className = "text-gray-500";
    let statusText = "No checks yet";

    if (entry) {
      className = entry.status === "success" ? "text-emerald-400" : "text-red-400";
      const parsed = new Date(entry.ranAt);
      const formatted = Number.isNaN(parsed.getTime()) ? entry.ranAt : parsed.toLocaleString();
      statusText = `${entry.status === "success" ? "Success" : "Fail"} · ${formatted}`;
    }

    return (
      <p className={`text-xs ${className}`}>
        {label}: {statusText}
      </p>
    );
  }

  function formatLastCheck(lastCheck?: string | null) {
    if (!lastCheck) {
      return new Date().toLocaleString();
    }
    const parsed = new Date(lastCheck);
    return Number.isNaN(parsed.getTime()) ? lastCheck : parsed.toLocaleString();
  }

  async function handleRedeploy(siteId: string) {
    try {
      showMessage("🚀 Redeploying site...", "info");
      const res = await fetch(`/api/deploy/${siteId}`, { method: "POST" });
      const data = (await res.json()) as { deployUrl?: string; error?: string };
      if (!res.ok) {
        throw new Error(data.error || "Redeploy failed");
      }
      showMessage("✅ Redeploy triggered!", "success");
      await fetchSites();
    } catch (error) {
      console.error("Redeploy failed", error);
      const message = error instanceof Error ? error.message : "Redeploy failed";
      showMessage(`❌ ${message}`, "error");
    }
  }

  async function handleBackup(siteId: string) {
    try {
      showMessage("💾 Starting backup...", "info");
      const res = await fetch(`/api/backup/${siteId}`, { method: "POST" });
      const data = (await res.json()) as { backupUrl?: string; error?: string };
      if (!res.ok) {
        throw new Error(data.error || "Backup failed");
      }
      showMessage("✅ Backup completed!", "success");
      await fetchSites();
    } catch (error) {
      console.error("Backup failed", error);
      const message = error instanceof Error ? error.message : "Backup failed";
      showMessage(`❌ ${message}`, "error");
    }
  }

  async function startCheckoutFlow(websiteId: string, targetPlan: WebsitePlan) {
    const checkoutKey = `${websiteId}:${targetPlan}`;
    try {
      setCheckoutLoading(checkoutKey);
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ websiteId, plan: targetPlan }),
      });
      const data = (await res.json()) as { url?: string; error?: string };
      if (!res.ok || !data.url) {
        throw new Error(data.error || "Unable to start checkout");
      }
      window.location.href = data.url;
    } catch (error) {
      console.error("Checkout session error", error);
      const messageText = error instanceof Error ? error.message : "Unable to start checkout";
      showMessage(`❌ ${messageText}`, "error");
    } finally {
      setCheckoutLoading(null);
    }
  }

  function showMessage(text: string, tone: MessageTone, duration = 4000) {
    if (messageTimeoutRef.current) {
      window.clearTimeout(messageTimeoutRef.current);
      messageTimeoutRef.current = null;
    }
    setMessage(text);
    setMessageTone(tone);
    if (text) {
      messageTimeoutRef.current = window.setTimeout(() => {
        setMessage("");
        setMessageTone("");
      }, duration);
    }
  }

  async function handleUpload(selectedFile?: File) {
    if (isBusy) return;

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
    setUploadProgress(5);
    showMessage("", "");

    try {
      const uploadPromise = startUpload([uploadFile]);
      if (!uploadPromise) {
        showMessage("❌ Upload failed to start", "error");
        setUploadProgress(null);
        setUploading(false);
        return;
      }
      await uploadPromise;
    } catch (error) {
      console.error("Upload failed", error);
      showMessage("❌ Upload failed. Please try again.", "error");
      setUploadProgress(null);
      setUploading(false);
    }
  }

  useEffect(() => {
    let isMounted = true;

    void fetchSites();

    const params = new URLSearchParams(window.location.search);
    const success = params.get("checkout") === "success";
    const websiteId = params.get("websiteId");

    const scheduleRefresh = (delay: number) => {
      const timeoutId = window.setTimeout(() => {
        void fetchSites();
      }, delay);
      verificationTimeoutsRef.current.push(timeoutId);
    };

    if (success && websiteId) {
      (async () => {
        showMessage("🔄 Verifying payment...", "info", 8000);

        try {
          const response = await fetch("/api/billing/verify", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ websiteId }),
          });

          const data = (await response.json()) as { ok?: boolean; plan?: string } & Record<string, unknown>;

          if (!isMounted) {
            return;
          }

          if (response.ok && data?.ok) {
            const planName = typeof data.plan === "string" ? data.plan.toUpperCase() : "updated";
            showMessage(`✅ Plan updated to ${planName}`, "success", 6000);
            void fetchSites();
            scheduleRefresh(3000);
          } else {
            showMessage("⚠️ Could not verify subscription yet.", "warning", 6000);
            scheduleRefresh(3000);
          }
        } catch (error) {
          console.error("Verification failed", error);
          if (isMounted) {
            showMessage("⚠️ Verification failed", "warning", 6000);
            scheduleRefresh(3000);
          }
        } finally {
          const updatedParams = new URLSearchParams(window.location.search);
          updatedParams.delete("checkout");
          updatedParams.delete("websiteId");
          const nextQuery = updatedParams.toString();
          const nextUrl = `${window.location.pathname}${nextQuery ? `?${nextQuery}` : ""}`;
          window.history.replaceState(null, "", nextUrl);

          if (isMounted) {
            scheduleRefresh(10000);
          }
        }
      })();
    }

    refreshIntervalRef.current = window.setInterval(() => {
      void fetchSites();
    }, 15000);

    return () => {
      isMounted = false;
      verificationTimeoutsRef.current.forEach((timeoutId) => {
        window.clearTimeout(timeoutId);
      });
      verificationTimeoutsRef.current = [];
      if (refreshIntervalRef.current !== null) {
        window.clearInterval(refreshIntervalRef.current);
        refreshIntervalRef.current = null;
      }
      if (messageTimeoutRef.current) {
        window.clearTimeout(messageTimeoutRef.current);
        messageTimeoutRef.current = null;
      }
    };
  }, []);

  function handleDragEnter(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    event.stopPropagation();
    if (isBusy) return;
    dragDepthRef.current += 1;
    if (!dragActive) {
      setDragActive(true);
    }
  }

  function handleDragOver(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    event.stopPropagation();
    if (isBusy) return;
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
    if (isBusy) return;

    const droppedFile = event.dataTransfer.files?.[0];
    if (!droppedFile) return;
    if (!droppedFile.name.toLowerCase().endsWith(".zip")) {
      showMessage("⚠️ Please drop a .zip file.", "warning");
      return;
    }
    handleUpload(droppedFile);
  }

  function openFileDialog() {
    if (!isBusy) {
      fileInputRef.current?.click();
    }
  }

  const faviconSrc = lastUploaded?.meta.faviconUrl?.startsWith("data:")
    ? lastUploaded.meta.faviconUrl
    : lastUploaded?.meta.faviconUrl || "";
  const fallbackFavicon = "/favicon.svg";

  return (
    <div className="min-h-screen bg-gray-950 p-8 text-white">
      <motion.h1
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="mb-4 text-3xl font-bold"
      >
        Your Uploaded Sites
      </motion.h1>
      <motion.p
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.1 }}
        className="mb-8 text-gray-400"
      >
        Upload a <code>.zip</code> folder of your static website (index.html required).
      </motion.p>

      <motion.div
        onClick={openFileDialog}
        onDragEnter={handleDragEnter}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        animate={{ scale: dragActive ? 1.02 : 1 }}
        transition={{ type: "spring", stiffness: 260, damping: 20 }}
        className={`relative mb-10 flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed p-10 text-center shadow-lg shadow-black/10 transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 ${
          dragActive
            ? "border-blue-400 bg-blue-900/20"
            : "border-gray-800 bg-gray-900 hover:border-gray-600 hover:bg-gray-900/70"
        } ${isBusy ? "pointer-events-none opacity-80" : ""}`}
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
          }}
        />

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25 }}
          className="flex flex-col items-center"
        >
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
          <p className="mt-1 text-xs text-gray-500">Max file size: {maxUploadSize}</p>
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              openFileDialog();
            }}
            disabled={isBusy}
            className="mt-6 inline-flex items-center gap-2 rounded-lg bg-blue-500 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300 disabled:cursor-not-allowed disabled:bg-blue-500/60"
          >
            {isBusy ? "Uploading..." : "Choose File"}
          </button>
        </motion.div>

        <AnimatePresence>
          {file && !isBusy && (
            <motion.div
              key="file-preview"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="mt-6 flex flex-col items-center text-sm text-gray-300"
            >
              <span>
                Selected: <strong>{file.name}</strong> ({(file.size / 1024).toFixed(1)} KB)
              </span>
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  handleUpload();
                }}
                className="mt-3 rounded-lg bg-emerald-500 px-4 py-1.5 text-xs font-semibold text-white transition hover:bg-emerald-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300"
              >
                Upload .zip
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {uploadProgress !== null && (
            <motion.div
              key="progress"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.25 }}
              className="mt-8 flex w-full max-w-md flex-col items-center"
            >
              <div className="h-2 w-full overflow-hidden rounded-full bg-gray-800">
                <motion.div
                  className="h-full rounded-full bg-blue-500"
                  initial={{ width: "0%" }}
                  animate={{ width: `${uploadProgress}%` }}
                  transition={{ ease: "easeInOut", duration: 0.2 }}
                />
              </div>
              <span className="mt-2 text-xs text-gray-400">{Math.round(uploadProgress)}%</span>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      <AnimatePresence>
        {message && (
          <motion.p
            key={message}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.25 }}
            className={`mb-4 text-sm ${
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
          </motion.p>
        )}
      </AnimatePresence>

      {message.includes("✅") && (
        <Lottie animationData={successAnim} loop={false} className="mx-auto mt-6 h-32 w-32" />
      )}

      <AnimatePresence>
        {lastUploaded && (
          <motion.div
            key={lastUploaded.siteId || lastUploaded.meta.title}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="mt-8 w-full max-w-xl rounded-xl border border-gray-800 bg-gray-900/80 p-4 text-left"
          >
            <div className="flex items-center gap-3">
              <img
                src={faviconSrc || fallbackFavicon}
                alt="favicon"
                className="h-10 w-10 rounded bg-gray-800 p-1"
              />
              <div>
                <h3 className="text-xl font-semibold mb-1">{lastUploaded.meta.title}</h3>
                <p className="text-sm text-gray-400">{lastUploaded.meta.description}</p>
              </div>
            </div>
            <span className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-green-400">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                className="h-4 w-4"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M4.5 12.75l6 6 9-13.5"
                />
              </svg>
              Analyzed &amp; Stored
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="mt-12">
        {sites.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="rounded-xl border border-gray-800 bg-gray-900 p-6 text-gray-400"
          >
            You have not uploaded any websites yet. Start by uploading a .zip via the form above.
          </motion.div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {sites.map((site, index) => {
              const siteId = getSiteId(site);
              const plan = (site.plan ?? "basic") as WebsitePlan;
              const billingStatus = (site.billingStatus ?? "inactive") as WebsiteBillingStatus;
              const planLabel = formatPlan(plan);
              const billingStatusLabel = formatBillingStatus(billingStatus);
              const isBillingActive = billingStatus === "active";
              const canAccessPremium = isBillingActive && (plan === "standard" || plan === "pro");
              const canAccessAutoReports = isBillingActive && plan === "pro";
              const upgradeTargets: WebsitePlan[] =
                plan === "basic" ? ["standard", "pro"] : plan === "standard" ? ["pro"] : [];

              return (
                <motion.div
                  key={siteId}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: index * 0.05 }}
                  className="rounded-xl border border-gray-800 bg-gray-900 p-4 transition hover:border-blue-400"
                >
                  <div className="mb-3 flex items-center gap-3">
                    <img
                      src={
                        site.meta?.faviconUrl && site.meta.faviconUrl.startsWith("data:")
                          ? site.meta.faviconUrl
                          : site.meta?.faviconUrl || fallbackFavicon
                      }
                      alt="site favicon"
                      className="h-8 w-8 rounded bg-gray-800 p-1"
                    />
                    <div>
                      <h2 className="text-xl font-semibold">{site.name}</h2>
                      <p className="mt-1 text-sm text-gray-400">Status: {site.status}</p>
                      <p className="text-sm text-gray-400">
                        Plan: <span className="font-semibold">{planLabel}</span> · Status: {billingStatusLabel}
                      </p>
                      {!isBillingActive && (
                        <p className="mt-1 text-xs text-amber-300">
                          Subscription {billingStatusLabel.toLowerCase()}. Upgrade to unlock premium automations.
                        </p>
                      )}
                    </div>
                  </div>
                  {upgradeTargets.length > 0 && (
                    <div className="mb-3 flex flex-wrap gap-2">
                      {upgradeTargets.map((targetPlan) => {
                        const checkoutKey = `${siteId}:${targetPlan}`;
                        const isLoading = checkoutLoading === checkoutKey;
                        return (
                          <button
                            key={targetPlan}
                            onClick={() => void startCheckoutFlow(siteId, targetPlan)}
                            disabled={isLoading}
                            className="mt-1 rounded-lg bg-amber-500 px-3 py-1 text-sm font-medium text-gray-900 transition hover:bg-amber-400 disabled:cursor-not-allowed disabled:bg-amber-700/60 disabled:text-gray-400"
                          >
                            {isLoading ? "Redirecting..." : `Upgrade to ${PLAN_LABELS[targetPlan]}`}
                          </button>
                        );
                      })}
                    </div>
                  )}
                  <p className="mt-1 text-sm text-gray-400">SEO Score: {site.meta?.seoScore ?? "N/A"}</p>
                  {site.deployUrl && (
                    <a
                      href={site.deployUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-3 inline-flex items-center gap-1 text-sm text-blue-400 hover:text-blue-300"
                    >
                      View Site
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        className="h-4 w-4"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="m14.25 6.75 3 3m0 0-3 3m3-3h-7.5a4.5 4.5 0 0 0-4.5 4.5V18"
                        />
                      </svg>
                    </a>
                  )}
                  <div className="mt-3 space-y-1">
                    {renderMaintenanceStatus("Uptime", site.maintenance?.uptime)}
                    {renderMaintenanceStatus("Backup", site.maintenance?.backup)}
                    {renderMaintenanceStatus("SEO", site.maintenance?.seo)}
                  </div>
                  <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
                    <p className="text-xs text-gray-400">
                      Last check: {formatLastCheck(site.lastCheck)}
                    </p>
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        onClick={async () => {
                          if (!canAccessPremium) {
                            showMessage("⚠️ Upgrade to Standard to unlock SEO audits.", "warning");
                            return;
                          }
                          const res = await fetch(`/api/seo/analyze/${siteId}`, { method: "POST" });
                          const data = (await res.json()) as {
                            analysis?: { score: number };
                            ai?: string;
                            error?: string;
                          };
                          if (!res.ok || data.error) {
                            alert(`SEO audit failed: ${data.error ?? res.statusText}`);
                            return;
                          }
                          alert(
                            `SEO Score: ${data.analysis?.score ?? "N/A"}` +
                              "\n\nAI Suggestions:\n" +
                              (data.ai ?? "No suggestions"),
                          );
                          void fetchSites();
                        }}
                        disabled={!canAccessPremium}
                        className={`rounded-lg px-3 py-1 text-sm transition ${
                          canAccessPremium
                            ? "bg-purple-600 hover:bg-purple-700"
                            : "cursor-not-allowed bg-gray-700 text-gray-400"
                        }`}
                      >
                        Run SEO Audit
                      </button>
                      <button
                        onClick={() => void handleRedeploy(siteId)}
                        className="rounded-lg bg-blue-600 px-3 py-1 text-sm transition hover:bg-blue-700"
                      >
                        Redeploy
                      </button>
                      <button
                        onClick={() => {
                          if (!canAccessPremium) {
                            showMessage("⚠️ Upgrade to Standard to unlock backups.", "warning");
                            return;
                          }
                          void handleBackup(siteId);
                        }}
                        disabled={!canAccessPremium}
                        className={`ml-2 rounded-lg px-3 py-1 text-sm transition ${
                          canAccessPremium
                            ? "bg-blue-600 hover:bg-blue-700"
                            : "cursor-not-allowed bg-gray-700 text-gray-400"
                        }`}
                      >
                        Backup Now
                      </button>
                      <button
                        onClick={() => {
                          if (!canAccessAutoReports) {
                            showMessage("⚠️ Upgrade to Pro for automated reports.", "warning");
                            return;
                          }
                          showMessage("✅ Weekly reports are automatically emailed to Pro clients.", "success");
                        }}
                        disabled={!canAccessAutoReports}
                        className={`rounded-lg px-3 py-1 text-sm transition ${
                          canAccessAutoReports
                            ? "bg-green-600 hover:bg-green-700"
                            : "cursor-not-allowed bg-gray-700 text-gray-400"
                        }`}
                      >
                        Enable Auto Reports
                      </button>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
