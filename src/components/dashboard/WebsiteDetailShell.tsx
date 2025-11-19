"use client";

import { useMemo, useState, type ReactNode } from "react";

import type {
  WebsiteDetailFileEntry,
  WebsiteDetailSummary,
  WebsiteLogEntry,
  WebsiteReportSummary,
} from "@/types/website-detail";

interface WebsiteDetailShellProps {
  website: WebsiteDetailSummary;
  latestReport: WebsiteReportSummary | null;
  logs: WebsiteLogEntry[];
}

type TabKey = "overview" | "seo" | "performance" | "files" | "logs";

const tabs: { key: TabKey; label: string }[] = [
  { key: "overview", label: "Overview" },
  { key: "seo", label: "SEO" },
  { key: "performance", label: "Performance" },
  { key: "files", label: "Files / Structure" },
  { key: "logs", label: "Logs" },
];

const PLAN_LABELS: Record<string, string> = {
  basic: "Basic",
  standard: "Standard",
  pro: "Pro",
};

const BILLING_STATUS_LABELS: Record<string, string> = {
  active: "Active",
  inactive: "Inactive",
  past_due: "Past due",
  canceled: "Canceled",
};

export default function WebsiteDetailShell({ website, latestReport, logs }: WebsiteDetailShellProps) {
  const [activeTab, setActiveTab] = useState<TabKey>("overview");
  const [isReanalyzing, setIsReanalyzing] = useState(false);
  const [isRedeploying, setIsRedeploying] = useState(false);

  async function handleAction(type: "reanalyze" | "redeploy") {
    const setter = type === "reanalyze" ? setIsReanalyzing : setIsRedeploying;
    setter(true);
    try {
      const response = await fetch(`/api/websites/${website._id}/${type}`, { method: "POST" });
      if (!response.ok) {
        throw new Error(`${type} failed`);
      }
      window.location.reload();
    } catch (error) {
      console.error(error);
      alert(`Failed to ${type}. Please try again.`);
    } finally {
      setter(false);
    }
  }

  const planLabel = PLAN_LABELS[website.plan ?? ""] ?? website.plan ?? "Basic";
  const billingLabel = BILLING_STATUS_LABELS[website.billingStatus ?? ""] ?? website.billingStatus ?? "Inactive";

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 shadow-lg shadow-black/20">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm uppercase tracking-widest text-slate-400">Website detail</p>
            <h1 className="mt-2 text-3xl font-semibold text-white">{website.name}</h1>
            <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
              <StatusBadge status={website.status} />
              {website.plan && <Badge>Plan: {planLabel}</Badge>}
              {website.billingStatus && <Badge>Billing: {billingLabel}</Badge>}
              {website.previewUrl && (
                <a
                  href={website.previewUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-full bg-blue-500/10 px-3 py-1 text-blue-300 transition hover:bg-blue-500/20"
                >
                  Preview site ↗
                </a>
              )}
            </div>
            {website.errorReason && (
              <p className="mt-2 text-sm text-rose-300">Issue: {website.errorReason}</p>
            )}
            <p className="mt-2 text-xs text-slate-400">
              Updated {formatDate(website.updatedAt)} · Created {formatDate(website.createdAt)}
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => handleAction("reanalyze")}
              disabled={isReanalyzing}
              className="rounded-lg bg-purple-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-purple-700 disabled:cursor-not-allowed disabled:bg-purple-600/60"
            >
              {isReanalyzing ? "Re-analyzing..." : "Re-analyze"}
            </button>
            <button
              type="button"
              onClick={() => handleAction("redeploy")}
              disabled={isRedeploying}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-600/60"
            >
              {isRedeploying ? "Redeploying..." : "Redeploy"}
            </button>
          </div>
        </div>
      </div>

      <div>
        <div className="flex flex-wrap gap-2 border-b border-slate-800">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              type="button"
              className={`rounded-t-lg px-4 py-2 text-sm font-medium transition ${
                activeTab === tab.key
                  ? "bg-slate-800 text-white"
                  : "text-slate-400 hover:text-white"
              }`}
              onClick={() => setActiveTab(tab.key)}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <div className="rounded-b-2xl rounded-tr-2xl border border-t-0 border-slate-800 bg-slate-900/40 p-6">
          {activeTab === "overview" && <WebsiteOverviewTab website={website} latestReport={latestReport} />}
          {activeTab === "seo" && <WebsiteSeoTab latestReport={latestReport} />}
          {activeTab === "performance" && <WebsitePerformanceTab latestReport={latestReport} />}
          {activeTab === "files" && <WebsiteFilesTab files={website.files ?? []} />}
          {activeTab === "logs" && <WebsiteLogsTab logs={logs} />}
        </div>
      </div>
    </div>
  );
}

function WebsiteOverviewTab({
  website,
  latestReport,
}: {
  website: WebsiteDetailSummary;
  latestReport: WebsiteReportSummary | null;
}) {
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [lastBackupAt, setLastBackupAt] = useState<string | null>(website.lastBackupAt ?? null);
  const [lastBackupKey, setLastBackupKey] = useState<string | null>(website.lastBackupKey ?? null);
  const [backupError, setBackupError] = useState<string | null>(null);

  const lastBackupLabel = lastBackupAt ? formatDate(lastBackupAt) : "Never backed up";
  const canDownloadBackup = Boolean(lastBackupKey);

  async function handleCreateBackup() {
    setIsBackingUp(true);
    setBackupError(null);
    try {
      const response = await fetch(`/api/backup/${website._id}`, { method: "POST" });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.ok) {
        throw new Error(data?.message ?? "Backup failed");
      }
      setLastBackupAt(data.lastBackupAt ?? new Date().toISOString());
      setLastBackupKey(data.backupKey ?? null);
      if (data.downloadUrl) {
        window.open(data.downloadUrl, "_blank", "noopener");
      }
    } catch (error) {
      console.error(error);
      setBackupError(error instanceof Error ? error.message : "Backup failed. Please try again.");
      alert("Backup failed. Please try again.");
    } finally {
      setIsBackingUp(false);
    }
  }

  async function handleDownloadBackup() {
    if (!canDownloadBackup) {
      return;
    }
    setIsDownloading(true);
    setBackupError(null);
    try {
      const response = await fetch(`/api/backup/${website._id}/download`);
      if (response.status === 404) {
        setBackupError("No backup found for this website.");
        alert("No backup found for this website.");
        return;
      }
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.ok || !data.downloadUrl) {
        throw new Error(data?.message ?? "Failed to get download link");
      }
      window.open(data.downloadUrl, "_blank", "noopener");
    } catch (error) {
      console.error(error);
      setBackupError(error instanceof Error ? error.message : "Failed to download backup.");
      alert("Failed to download backup.");
    } finally {
      setIsDownloading(false);
    }
  }

  const stats = [
    { label: "Pages", value: latestReport?.pageCount ?? 0 },
    { label: "Assets", value: latestReport?.assetCount ?? 0 },
    { label: "Images", value: latestReport?.imageCount ?? 0 },
  ];

  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-[1.2fr,1fr]">
        <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-5">
          <h3 className="text-lg font-semibold text-white">Deployment</h3>
          <p className="mt-1 text-sm text-slate-400">Status: {website.status}</p>
          {website.deployUrl && (
            <a
              href={website.deployUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-3 inline-flex items-center gap-1 text-sm text-blue-300 hover:text-blue-200"
            >
              View live site
              <span aria-hidden>↗</span>
            </a>
          )}
          <div className="mt-6 border-t border-slate-800 pt-4">
            <div className="flex flex-col gap-1">
              <h4 className="text-sm font-semibold text-white">Backups</h4>
              <p className="text-xs text-slate-400">Last backup: {lastBackupLabel}</p>
              {backupError && <p className="text-xs text-rose-400">{backupError}</p>}
            </div>
            <div className="mt-4 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={handleCreateBackup}
                disabled={isBackingUp}
                className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-emerald-600/60"
              >
                {isBackingUp ? "Creating backup..." : "Create backup"}
              </button>
              <button
                type="button"
                onClick={handleDownloadBackup}
                disabled={!canDownloadBackup || isDownloading}
                className="rounded-lg bg-slate-800 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-800/60"
              >
                {isDownloading ? "Preparing download..." : "Download last backup"}
              </button>
            </div>
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <ScoreCard label="SEO score" score={latestReport?.seoScore ?? null} tone="emerald" />
          <ScoreCard label="Performance score" score={latestReport?.performanceScore ?? null} tone="blue" />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {stats.map((stat) => (
          <div key={stat.label} className="rounded-xl border border-slate-800 bg-slate-900/80 p-4">
            <p className="text-sm text-slate-400">{stat.label}</p>
            <p className="mt-2 text-2xl font-semibold text-white">{stat.value}</p>
          </div>
        ))}
      </div>

      {!latestReport && (
        <EmptyState
          title="No analysis yet"
          description="We have not generated a report for this website yet. Run Re-analyze to get fresh insights."
        />
      )}
    </div>
  );
}

function WebsiteSeoTab({ latestReport }: { latestReport: WebsiteReportSummary | null }) {
  if (!latestReport) {
    return <EmptyState title="No SEO report" description="Run a report to see SEO issues and opportunities." />;
  }

  const sections = [
    { key: "missingTitle", title: "Missing titles" },
    { key: "missingDescription", title: "Missing descriptions" },
    { key: "missingOrMultipleH1", title: "Missing or multiple H1" },
    { key: "missingCanonical", title: "Missing canonical" },
    { key: "missingAlt", title: "Missing alt text" },
  ] as const;

  return (
    <div className="space-y-6">
      <ScoreCard label="SEO score" score={latestReport.seoScore} tone="emerald" compact />
      {sections.map((section) => {
        const items = latestReport.seoIssues?.[section.key] ?? [];
        return (
          <div key={section.key} className="rounded-xl border border-slate-800 bg-slate-900/70 p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h3 className="text-lg font-semibold text-white">{section.title}</h3>
              {items.length === 0 ? (
                <span className="text-sm text-emerald-400">✅ None</span>
              ) : (
                <span className="text-sm text-amber-300">{items.length} issues</span>
              )}
            </div>
            {items.length > 0 && (
              <div className="mt-4 overflow-x-auto">
                <table className="w-full text-left text-sm text-slate-300">
                  <thead>
                    <tr className="text-xs uppercase tracking-wide text-slate-400">
                      <th className="px-2 py-2">Path</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((path) => (
                      <tr key={path} className="border-t border-slate-800">
                        <td className="px-2 py-2">
                          <code className="rounded bg-slate-800/70 px-2 py-1 text-xs text-slate-200">{path}</code>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function WebsitePerformanceTab({ latestReport }: { latestReport: WebsiteReportSummary | null }) {
  if (!latestReport) {
    return <EmptyState title="No performance data" description="Run a report to view performance insights." />;
  }

  const { largeImages = [], largeAssets = [] } = latestReport.performanceIssues ?? {};

  return (
    <div className="space-y-6">
      <ScoreCard label="Performance score" score={latestReport.performanceScore} tone="blue" compact />
      <IssueTable
        title="Large images"
        description="Consider optimizing these images for faster loads."
        rows={largeImages.map((entry) => ({ path: entry.path, size: `${entry.sizeKb} KB` }))}
        emptyLabel="✅ No large images detected"
      />
      <IssueTable
        title="Large assets"
        description="Heavy scripts or styles can slow down your site."
        rows={largeAssets.map((entry) => ({ path: entry.path, size: `${entry.sizeKb} KB` }))}
        emptyLabel="✅ No large assets detected"
      />
    </div>
  );
}

function WebsiteFilesTab({ files }: { files: WebsiteDetailFileEntry[] }) {
  if (!files || files.length === 0) {
    return <EmptyState title="No files available" description="Upload a site archive to inspect its file structure." />;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm text-slate-200">
        <thead>
          <tr className="text-xs uppercase tracking-wide text-slate-400">
            <th className="px-3 py-2">Path</th>
            <th className="px-3 py-2">Size (KB)</th>
            <th className="px-3 py-2">Type</th>
          </tr>
        </thead>
        <tbody>
          {files.map((file) => (
            <tr key={`${file.path}-${file.sizeBytes}`} className="border-t border-slate-800">
              <td className="px-3 py-2 font-mono text-xs text-slate-100">{file.path}</td>
              <td className="px-3 py-2">{Math.round(file.sizeBytes / 1024)}</td>
              <td className="px-3 py-2 text-slate-400">{file.contentType ?? "Unknown"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function WebsiteLogsTab({ logs }: { logs: WebsiteLogEntry[] }) {
  const sortedLogs = useMemo(
    () => [...logs].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)),
    [logs],
  );

  if (sortedLogs.length === 0) {
    return <EmptyState title="No maintenance logs" description="Trigger an action to start seeing activity here." />;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm text-slate-200">
        <thead>
          <tr className="text-xs uppercase tracking-wide text-slate-400">
            <th className="px-3 py-2">When</th>
            <th className="px-3 py-2">Type</th>
            <th className="px-3 py-2">Level</th>
            <th className="px-3 py-2">Message</th>
          </tr>
        </thead>
        <tbody>
          {sortedLogs.map((log) => (
            <tr key={log._id} className="border-t border-slate-800">
              <td className="px-3 py-2 text-xs text-slate-400">{formatDateTime(log.createdAt)}</td>
              <td className="px-3 py-2">{log.type}</td>
              <td className="px-3 py-2">
                <span className={`rounded-full px-2 py-0.5 text-xs ${getLevelStyles(log.level)}`}>{log.level}</span>
              </td>
              <td className="px-3 py-2 text-slate-100">{log.message}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ScoreCard({
  label,
  score,
  tone,
  compact = false,
}: {
  label: string;
  score: number | null;
  tone: "emerald" | "blue";
  compact?: boolean;
}) {
  const percent = typeof score === "number" ? Math.max(0, Math.min(score, 100)) : 0;
  const barClass = tone === "emerald" ? "bg-emerald-500" : "bg-blue-500";

  return (
    <div className={`rounded-xl border border-slate-800 bg-slate-900/80 p-4 ${compact ? "max-w-xs" : ""}`}>
      <p className="text-sm text-slate-400">{label}</p>
      <p className="mt-2 text-3xl font-semibold text-white">{typeof score === "number" ? score : "N/A"}</p>
      <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-slate-800">
        <div className={`h-full ${barClass}`} style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}

function IssueTable({
  title,
  description,
  rows,
  emptyLabel,
}: {
  title: string;
  description: string;
  rows: { path: string; size: string }[];
  emptyLabel: string;
}) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-5">
      <div className="flex flex-col gap-1">
        <h3 className="text-lg font-semibold text-white">{title}</h3>
        <p className="text-sm text-slate-400">{description}</p>
      </div>
      {rows.length === 0 ? (
        <p className="mt-4 text-sm text-emerald-400">{emptyLabel}</p>
      ) : (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-200">
            <thead>
              <tr className="text-xs uppercase tracking-wide text-slate-400">
                <th className="px-3 py-2">Path</th>
                <th className="px-3 py-2">Size</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={`${row.path}-${row.size}`} className="border-t border-slate-800">
                  <td className="px-3 py-2 font-mono text-xs text-slate-100">{row.path}</td>
                  <td className="px-3 py-2">{row.size}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function EmptyState({ title, description }: { title: string; description?: string }) {
  return (
    <div className="rounded-xl border border-dashed border-slate-800 bg-slate-950/40 p-6 text-center">
      <p className="text-base font-medium text-slate-200">{title}</p>
      {description && <p className="mt-2 text-sm text-slate-400">{description}</p>}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const style = STATUS_STYLES[status] ?? "bg-slate-800 text-slate-200";
  return <span className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide ${style}`}>{status}</span>;
}

const STATUS_STYLES: Record<string, string> = {
  deployed: "bg-emerald-500/20 text-emerald-300",
  ready: "bg-emerald-500/20 text-emerald-300",
  analyzing: "bg-blue-500/20 text-blue-300",
  uploaded: "bg-blue-500/20 text-blue-300",
  deploying: "bg-blue-500/20 text-blue-300",
  failed: "bg-rose-500/20 text-rose-300",
  error: "bg-rose-500/20 text-rose-300",
};

function Badge({ children }: { children: ReactNode }) {
  return <span className="rounded-full bg-slate-800 px-3 py-1 text-xs text-slate-300">{children}</span>;
}

function formatDate(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return iso;
  }
  return date.toLocaleString();
}

function formatDateTime(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return iso;
  }
  return date.toLocaleString();
}

function getLevelStyles(level: string) {
  switch (level) {
    case "success":
      return "bg-emerald-500/20 text-emerald-300";
    case "failure":
    case "error":
      return "bg-rose-500/20 text-rose-300";
    case "warning":
      return "bg-amber-500/20 text-amber-300";
    default:
      return "bg-slate-800 text-slate-300";
  }
}
