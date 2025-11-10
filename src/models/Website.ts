import { Schema, model, models, type Document, type Types } from "mongoose";

export interface WebsiteMeta {
  pages: number;
  scripts: number;
  seoScore: number;
  title: string;
  description: string;
  faviconUrl?: string;
}

export type WebsitePlan = "basic" | "standard" | "pro";
export type WebsiteBillingStatus = "inactive" | "active" | "past_due" | "canceled";

export interface WebsiteDocument extends Document {
  name: string;
  userEmail: string;
  accountId?: Types.ObjectId;
  status: "uploaded" | "analyzed" | "deployed" | "failed";
  deployUrl?: string;
  archiveUrl?: string;
  zipUrl?: string;
  plan: WebsitePlan;
  billingStatus: WebsiteBillingStatus;
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  meta: WebsiteMeta;
  createdAt: Date;
  updatedAt: Date;
}

const WebsiteSchema = new Schema<WebsiteDocument>(
  {
    name: { type: String, required: true },
    userEmail: { type: String, required: true, index: true },
    accountId: { type: Schema.Types.ObjectId, ref: "Account", index: true },
    status: {
      type: String,
      enum: ["uploaded", "analyzed", "deployed", "failed"],
      default: "uploaded",
    },
    deployUrl: { type: String },
    archiveUrl: { type: String },
    zipUrl: { type: String },
    plan: {
      type: String,
      enum: ["basic", "standard", "pro"],
      default: "basic",
    },
    billingStatus: {
      type: String,
      enum: ["inactive", "active", "past_due", "canceled"],
      default: "inactive",
    },
    stripeCustomerId: { type: String },
    stripeSubscriptionId: { type: String },
    meta: {
      pages: { type: Number, default: 0 },
      scripts: { type: Number, default: 0 },
      seoScore: { type: Number, default: 0 },
      title: { type: String, default: "" },
      description: { type: String, default: "" },
      faviconUrl: { type: String, default: "" },
    },
  },
  {
    timestamps: true,
  },
);

WebsiteSchema.index({ createdAt: -1 });

const Website = models.Website || model<WebsiteDocument>("Website", WebsiteSchema);

export default Website;
