import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Tauri serves static files only, so the app ships as a static export in out/ (ADR-0001).
  output: "export",
};

export default nextConfig;
