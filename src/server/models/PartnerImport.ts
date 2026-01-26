import mongoose, { Schema, type InferSchemaType } from "mongoose";

const partnerImportSchema = new Schema(
  {
    originalFileName: { type: String, required: true },
    fileUrl: { type: String, required: true },
    localPath: { type: String, required: true },
    fileHash: { type: String, required: true },
    status: {
      type: String,
      enum: ["queued", "running", "succeeded", "failed"],
      required: true,
      default: "queued",
      index: true,
    },
    createdAt: { type: Date, default: Date.now, index: true },
    startedAt: { type: Date },
    finishedAt: { type: Date },
    summary: {
      inserted: { type: Number, default: 0 },
      updated: { type: Number, default: 0 },
      unchanged: { type: Number, default: 0 },
      failedRows: { type: Number, default: 0 },
    },
    errorLog: { type: String },
    rowErrors: {
      type: [
        {
          row: { type: Number },
          externalKey: { type: String },
          message: { type: String },
        },
      ],
      default: undefined,
    },
    warnings: {
      type: [
        {
          row: { type: Number },
          externalKey: { type: String },
          message: { type: String },
        },
      ],
      default: undefined,
    },
  },
  { collection: "partner_imports" }
);

partnerImportSchema.index({ fileHash: 1 });
partnerImportSchema.index({ createdAt: -1 });

export type PartnerImportDoc = InferSchemaType<typeof partnerImportSchema> & { _id: mongoose.Types.ObjectId };

export const PartnerImport =
  (mongoose.models.PartnerImport as mongoose.Model<PartnerImportDoc>) ||
  mongoose.model<PartnerImportDoc>("PartnerImport", partnerImportSchema);
