import mongoose, { Schema, type InferSchemaType } from "mongoose";

const partnerGeocodeJobSchema = new Schema(
  {
    status: {
      type: String,
      enum: ["queued", "running", "succeeded", "failed"],
      default: "queued",
      index: true,
    },

    createdAt: { type: Date, default: Date.now, index: true },
    startedAt: { type: Date },
    finishedAt: { type: Date },

    requestedLimit: { type: Number },

    summary: {
      totalCandidates: { type: Number, default: 0 },
      processed: { type: Number, default: 0 },
      updated: { type: Number, default: 0 },
      skipped: { type: Number, default: 0 },
      failed: { type: Number, default: 0 },
    },

    errorLog: { type: String },

    rowErrors: {
      type: [
        {
          schoolId: { type: String },
          externalKey: { type: String },
          message: { type: String },
        },
      ],
      default: undefined,
    },
  },
  { collection: "partner_geocode_jobs" }
);

export type PartnerGeocodeJobDoc = InferSchemaType<typeof partnerGeocodeJobSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const PartnerGeocodeJob =
  (mongoose.models.PartnerGeocodeJob as mongoose.Model<PartnerGeocodeJobDoc>) ||
  mongoose.model<PartnerGeocodeJobDoc>("PartnerGeocodeJob", partnerGeocodeJobSchema);
