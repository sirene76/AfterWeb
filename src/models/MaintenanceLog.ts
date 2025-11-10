import mongoose, { Schema, type Document, type Model } from "mongoose";

export type MaintenanceLogType = "uptime" | "backup" | "seo";

export type MaintenanceLogStatus = "success" | "fail";

export interface MaintenanceLogDocument extends Document {
  websiteId: mongoose.Types.ObjectId;
  type: MaintenanceLogType;
  status: MaintenanceLogStatus;
  details?: unknown;
  createdAt: Date;
}

const MaintenanceLogSchema = new Schema<MaintenanceLogDocument>(
  {
    websiteId: { type: Schema.Types.ObjectId, ref: "Website", required: true, index: true },
    type: { type: String, enum: ["uptime", "backup", "seo"], required: true, index: true },
    status: { type: String, enum: ["success", "fail"], required: true },
    details: Schema.Types.Mixed,
    createdAt: { type: Date, default: Date.now, index: true },
  },
  {
    timestamps: false,
  },
);

MaintenanceLogSchema.index({ websiteId: 1, type: 1, createdAt: -1 });

const MaintenanceLog: Model<MaintenanceLogDocument> =
  mongoose.models.MaintenanceLog ?? mongoose.model("MaintenanceLog", MaintenanceLogSchema);

export default MaintenanceLog;
