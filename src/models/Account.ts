import { Schema, model, models, type Document } from "mongoose";

type AccountType = "agency" | "personal" | "client";

export interface AccountDocument extends Document {
  name: string;
  type: AccountType;
  ownerEmail: string;
  createdAt: Date;
  updatedAt: Date;
}

const AccountSchema = new Schema<AccountDocument>(
  {
    name: { type: String, required: true },
    type: {
      type: String,
      enum: ["agency", "personal", "client"],
      default: "agency",
    },
    ownerEmail: { type: String, required: true, index: true },
  },
  {
    timestamps: true,
  },
);

const Account = models.Account || model<AccountDocument>("Account", AccountSchema);

export default Account;
