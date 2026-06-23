import mongoose from "mongoose";
import { env } from "../config/env";

/**
 * Connects to MongoDB. If no URI is set, the server still boots so the
 * non-DB endpoints work. We use a short server-selection timeout so that
 * if Atlas is unreachable (e.g. IP not allow-listed), queries fail fast
 * with a clear error instead of hanging requests forever.
 */
export async function connectMongo(): Promise<void> {
  if (!env.mongodbUri) {
    console.warn("[mongo] MONGODB_URI not set — skipping DB connection.");
    return;
  }

  // Fail fast instead of buffering commands indefinitely.
  mongoose.set("bufferTimeoutMS", 8000);

  mongoose.connection.on("connected", () => console.log("[mongo] connected"));
  mongoose.connection.on("error", (e) =>
    console.error("[mongo] connection error:", e.message)
  );
  mongoose.connection.on("disconnected", () =>
    console.warn("[mongo] disconnected")
  );

  try {
    await mongoose.connect(env.mongodbUri, {
      serverSelectionTimeoutMS: 8000,
    });
  } catch (err) {
    console.error(
      "[mongo] INITIAL CONNECT FAILED. Check your MONGODB_URI and that your IP " +
        "is allow-listed in Atlas → Network Access.\n",
      err instanceof Error ? err.message : err
    );
  }
}
