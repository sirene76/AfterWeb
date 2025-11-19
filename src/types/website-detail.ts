export interface WebsiteDetailFileEntry {
  path: string;
  sizeBytes: number;
  contentType?: string | null;
}

export interface WebsiteDetailSummary {
  _id: string;
  name: string;
  status: string;
  previewUrl?: string;
  deployUrl?: string;
  plan?: string | null;
  billingStatus?: string | null;
  errorReason?: string | null;
  zipUrl?: string | null;
  lastBackupAt?: string | null;
  lastBackupKey?: string | null;
  lastBackupUrl?: string | null;
  files?: WebsiteDetailFileEntry[];
  createdAt: string;
  updatedAt: string;
}

export interface WebsiteReportIssueLists {
  missingTitle: string[];
  missingDescription: string[];
  missingOrMultipleH1: string[];
  missingCanonical: string[];
  missingAlt: string[];
}

export interface WebsitePerformanceIssueLists {
  largeImages: { path: string; sizeKb: number }[];
  largeAssets: { path: string; sizeKb: number }[];
}

export interface WebsiteReportSummary {
  _id: string;
  createdAt: string;
  pageCount: number;
  assetCount: number;
  imageCount: number;
  seoScore: number;
  performanceScore: number;
  seoIssues: WebsiteReportIssueLists;
  performanceIssues: WebsitePerformanceIssueLists;
  summary?: string | null;
}

export interface WebsiteLogEntry {
  _id: string;
  type: string;
  level: string;
  message: string;
  createdAt: string;
}

export interface WebsiteDetailResponse {
  ok: boolean;
  website: WebsiteDetailSummary;
  latestReport: WebsiteReportSummary | null;
  logs: WebsiteLogEntry[];
  error?: string;
  message?: string;
}
