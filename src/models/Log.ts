import mongoose, { Schema, type Document, type Model } from "mongoose";

export type LogStatus = "success" | "failure" | "info";

export interface LogDocument extends Document {
  event: string;
  status: LogStatus;
  message: string;
  accountId?: mongoose.Types.ObjectId;
  websiteId?: mongoose.Types.ObjectId;
  metadata?: Record<string, unknown>;
  createdAt: Date;
}

const LogSchema = new Schema<LogDocument>(
  {
    event: { type: String, required: true, index: true },
    status: { type: String, enum: ["success", "failure", "info"], default: "info" },
    message: { type: String, required: true },
    accountId: { type: Schema.Types.ObjectId, ref: "Account" },
    websiteId: { type: Schema.Types.ObjectId, ref: "Website" },
    metadata: Schema.Types.Mixed,
    createdAt: { type: Date, default: Date.now, index: true },
  },
  {
    timestamps: false,
  },
);

const Log: Model<LogDocument> = mongoose.models.Log ?? mongoose.model<LogDocument>("Log", LogSchema);

export default Log;
