import mongoose, { Schema, type Document, type Model } from "mongoose";

export type MaintenanceLogType = "uptime" | "backup" | "seo";

export interface MaintenanceLogDocument extends Document {
  websiteId: string;
  type: MaintenanceLogType;
  result: unknown;
  status: string;
  createdAt: Date;
}

const MaintenanceLogSchema = new Schema<MaintenanceLogDocument>(
  {
    websiteId: { type: String, required: true, index: true },
    type: {
      type: String,
      required: true,
      enum: ["uptime", "backup", "seo"],
      index: true,
    },
    result: Schema.Types.Mixed,
    status: { type: String, required: true },
    createdAt: { type: Date, default: Date.now, index: true },
  },
  { timestamps: false },
);

MaintenanceLogSchema.index({ websiteId: 1, type: 1, createdAt: -1 });

const MaintenanceLog: Model<MaintenanceLogDocument> =
  mongoose.models.MaintenanceLog ||
  mongoose.model<MaintenanceLogDocument>("MaintenanceLog", MaintenanceLogSchema);

export default MaintenanceLog;
