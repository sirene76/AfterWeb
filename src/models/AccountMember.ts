import mongoose, { Schema, model, models } from "mongoose";

const AccountMemberSchema = new Schema({
  accountId: { type: Schema.Types.ObjectId, ref: "Account", required: true },
  userEmail: { type: String, required: true },
  role: { type: String, enum: ["owner", "admin", "member"], default: "owner" },
});

export default models.AccountMember || model("AccountMember", AccountMemberSchema);
