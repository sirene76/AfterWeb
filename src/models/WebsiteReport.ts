import { Schema, model, models, type Document, type Types } from "mongoose";

export interface ISeoIssueList {
  missingTitle: string[];
  missingDescription: string[];
  missingOrMultipleH1: string[];
  missingCanonical: string[];
  missingAlt: string[];
}

export interface IPerformanceIssueList {
  largeImages: { path: string; sizeKb: number }[];
  largeAssets: { path: string; sizeKb: number }[];
}

export interface IWebsiteReport extends Document {
  website: Types.ObjectId;
  createdAt: Date;
  pageCount: number;
  assetCount: number;
  imageCount: number;
  seoScore: number;
  performanceScore: number;
  seoIssues: ISeoIssueList;
  performanceIssues: IPerformanceIssueList;
  summary?: string;
}

const WebsiteReportSchema = new Schema<IWebsiteReport>(
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
  models.WebsiteReport || model<IWebsiteReport>("WebsiteReport", WebsiteReportSchema);

export default WebsiteReport;
