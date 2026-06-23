import dotenv from "dotenv";

dotenv.config();

// CLIENT_ORIGIN may be a comma-separated list (prod URL, preview URLs, localhost).
const origins = (process.env.CLIENT_ORIGIN ?? "http://localhost:3000")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

export const env = {
  port: Number(process.env.PORT ?? 4000),
  clientOrigin: origins[0],
  clientOrigins: origins,
  mongodbUri: process.env.MONGODB_URI ?? "",
  dailyApiKey: process.env.DAILY_API_KEY ?? "",
  jwtSecret: process.env.JWT_SECRET ?? "dev-secret",
  adminPassword: process.env.ADMIN_PASSWORD ?? "admin123",
};
