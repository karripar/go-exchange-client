import mongoose, { Schema, type InferSchemaType } from "mongoose";

const languageRequirementSchema = new Schema(
  {
    language: { type: String, required: true },
    level: { type: String, required: true },
    notes: { type: String },
  },
  { _id: false }
);

const geoPointSchema = new Schema(
  {
    type: { type: String, enum: ["Point"], required: true },
    coordinates: {
      type: [Number],
      required: true,
      validate: {
        validator: (arr: number[]) => Array.isArray(arr) && arr.length === 2,
        message: "coordinates must be [lon, lat]",
      },
    },
  },
  { _id: false }
);

const partnerSchoolSchema = new Schema(
  {
    externalKey: { type: String, required: true, unique: true, index: true },

    name: { type: String, required: true },
    continent: { type: String, index: true },
    country: { type: String, index: true },
    city: { type: String },

    status: {
      type: String,
      enum: ["confirmed", "negotiation", "unknown"],
      default: "unknown",
      index: true,
    },

    mobilityProgrammes: { type: [String], default: [] },
    languageRequirements: { type: [languageRequirementSchema], default: [] },

    agreementScope: { type: String },
    degreeProgrammesInAgreement: { type: [String], default: [] },
    furtherInfo: { type: String },

    location: { type: geoPointSchema, required: false },
    geocodePrecision: {
      type: String,
      enum: ["none", "city", "manual"],
      default: "none",
    },

    geocodeProvider: { type: String },
    geocodeQuery: { type: String },
    geocodeUpdatedAt: { type: Date },

    sourceImportId: { type: Schema.Types.ObjectId, ref: "PartnerImport", index: true },
  },
  { collection: "partner_schools", timestamps: true }
);

partnerSchoolSchema.index({ location: "2dsphere" });
partnerSchoolSchema.index({ "languageRequirements.language": 1 });

export type PartnerSchoolDoc = InferSchemaType<typeof partnerSchoolSchema> & { _id: mongoose.Types.ObjectId };

export const PartnerSchool =
  (mongoose.models.PartnerSchool as mongoose.Model<PartnerSchoolDoc>) ||
  mongoose.model<PartnerSchoolDoc>("PartnerSchool", partnerSchoolSchema);
