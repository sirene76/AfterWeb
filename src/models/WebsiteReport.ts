import { Schema, model, models, type Document, type Types } from "mongoose";

export interface WebsiteReportSeoIssues {
  missingTitle: string[];
  missingDescription: string[];
  missingOrMultipleH1: string[];
  missingCanonical: string[];
  missingAlt: string[];
}

export interface WebsiteReportPerformanceIssue {
  path: string;
  sizeKb: number;
}

export interface WebsiteReportPerformanceIssues {
  largeImages: WebsiteReportPerformanceIssue[];
  largeAssets: WebsiteReportPerformanceIssue[];
}

export interface WebsiteReportDocument extends Document {
  website: Types.ObjectId;
  pageCount: number;
  assetCount: number;
  imageCount: number;
  seoScore: number;
  performanceScore: number;
  seoIssues: WebsiteReportSeoIssues;
  performanceIssues: WebsiteReportPerformanceIssues;
  summary?: string;
  createdAt: Date;
}

const WebsiteReportSchema = new Schema<WebsiteReportDocument>(
  {
    website: { type: Schema.Types.ObjectId, ref: "Website", required: true, index: true },
    pageCount: { type: Number, required: true },
    assetCount: { type: Number, required: true },
    imageCount: { type: Number, required: true },
    seoScore: { type: Number, min: 0, max: 100, required: true },
    performanceScore: { type: Number, min: 0, max: 100, required: true },
    seoIssues: {
      missingTitle: { type: [String], default: [] },
      missingDescription: { type: [String], default: [] },
      missingOrMultipleH1: { type: [String], default: [] },
      missingCanonical: { type: [String], default: [] },
      missingAlt: { type: [String], default: [] },
    },
    performanceIssues: {
      largeImages: {
        type: [
          {
            path: { type: String, required: true },
            sizeKb: { type: Number, required: true },
          },
        ],
        default: [],
      },
      largeAssets: {
        type: [
          {
            path: { type: String, required: true },
            sizeKb: { type: Number, required: true },
          },
        ],
        default: [],
      },
    },
    summary: { type: String },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  },
);

WebsiteReportSchema.index({ website: 1, createdAt: -1 });

const WebsiteReport =
  models.WebsiteReport || model<WebsiteReportDocument>("WebsiteReport", WebsiteReportSchema);

export default WebsiteReport;
