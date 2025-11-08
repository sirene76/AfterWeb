import { Schema, model, models, type Document } from "mongoose";

export interface WebsiteMeta {
  pages: number;
  scripts: number;
  seoScore: number;
  title: string;
  description: string;
}

export interface WebsiteDocument extends Document {
  name: string;
  userEmail: string;
  status: "uploaded" | "analyzed" | "deployed" | "failed";
  deployUrl?: string;
  meta: WebsiteMeta;
  createdAt: Date;
  updatedAt: Date;
}

const WebsiteSchema = new Schema<WebsiteDocument>(
  {
    name: { type: String, required: true },
    userEmail: { type: String, required: true, index: true },
    status: {
      type: String,
      enum: ["uploaded", "analyzed", "deployed", "failed"],
      default: "uploaded",
    },
    deployUrl: { type: String },
    meta: {
      pages: { type: Number, default: 0 },
      scripts: { type: Number, default: 0 },
      seoScore: { type: Number, default: 0 },
      title: { type: String, default: "" },
      description: { type: String, default: "" },
    },
  },
  {
    timestamps: true,
  },
);

WebsiteSchema.index({ createdAt: -1 });

const Website = models.Website || model<WebsiteDocument>("Website", WebsiteSchema);

export default Website;
