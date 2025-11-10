import { Schema, model, models, type Document, type Types } from "mongoose";

type AccountRole = "owner" | "member" | "client";

export interface AccountMemberDocument extends Document {
  accountId: Types.ObjectId;
  userEmail: string;
  role: AccountRole;
  createdAt: Date;
  updatedAt: Date;
}

const AccountMemberSchema = new Schema<AccountMemberDocument>(
  {
    accountId: { type: Schema.Types.ObjectId, ref: "Account", required: true, index: true },
    userEmail: { type: String, required: true, index: true },
    role: {
      type: String,
      enum: ["owner", "member", "client"],
      default: "member",
    },
  },
  {
    timestamps: true,
  },
);

AccountMemberSchema.index({ accountId: 1, userEmail: 1 }, { unique: true });

const AccountMember =
  models.AccountMember || model<AccountMemberDocument>("AccountMember", AccountMemberSchema);

export default AccountMember;
