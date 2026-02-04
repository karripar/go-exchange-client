import mongoose from "mongoose";

declare global {
  // eslint-disable-next-line no-var
  var __mongooseConn: { conn: typeof mongoose | null; promise: Promise<typeof mongoose> | null } | undefined;
}

const cached = global.__mongooseConn ?? { conn: null, promise: null };
if (!global.__mongooseConn) global.__mongooseConn = cached;

export async function connectMongo() {
  if (cached.conn) return cached.conn;

  const uri = process.env.DB_URL || process.env.MONGODB_URI;
  if (!uri) {
    throw new Error("Missing DB_URL (or MONGODB_URI) in Next.js server env");
  }

  if (!cached.promise) {
    cached.promise = mongoose
      .connect(uri)
      .then((m) => m)
      .catch((err) => {
        cached.promise = null;
        throw err;
      });
  }

  cached.conn = await cached.promise;
  return cached.conn;
}
