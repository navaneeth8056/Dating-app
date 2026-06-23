import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Pin the workspace root to this folder so Next stops picking up the
  // stray lockfile in your home directory (silences the multi-lockfile warning).
  turbopack: {
    root: __dirname,
  },
};

export default nextConfig;
