import mongoose, { Schema, model, models } from "mongoose";

const AccountSchema = new Schema({
  name: { type: String, required: true },
  type: { type: String, default: "personal" },
  ownerEmail: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
});

export default models.Account || model("Account", AccountSchema);
