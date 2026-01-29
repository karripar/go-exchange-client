import mongoose, { Schema, type InferSchemaType } from "mongoose";

const geocodeCacheSchema = new Schema(
  {
    query: { type: String, required: true, unique: true, index: true },
    provider: { type: String, required: true, default: "nominatim" },
    result: {
      lat: { type: Number },
      lon: { type: Number },
      displayName: { type: String },
      raw: { type: Schema.Types.Mixed },
    },
    ok: { type: Boolean, required: true, default: false },
    createdAt: { type: Date, default: Date.now, index: true },
  },
  { collection: "geocode_cache" }
);

export type GeocodeCacheDoc = InferSchemaType<typeof geocodeCacheSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const GeocodeCache =
  (mongoose.models.GeocodeCache as mongoose.Model<GeocodeCacheDoc>) ||
  mongoose.model<GeocodeCacheDoc>("GeocodeCache", geocodeCacheSchema);
