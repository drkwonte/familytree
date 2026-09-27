import { rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import type { NextConfig } from "next";
import { buildPagesWorkerSource } from "./src/lib/genogram/pages-worker";

const isCloudflarePages = process.env.CF_PAGES === "1";
const PUBLIC_WORKER_PATH = path.join(process.cwd(), "public", "_worker.js");
const PUBLIC_KEY_STATUS_PATH = path.join(process.cwd(), "public", "cf-key-status.json");
const GEMINI_API_KEY_NAME = ["GEMINI", "API", "KEY"].join("_");

function readBuildSecret(name: string): string {
  const value = process.env[name];
  return typeof value === "string" ? value.trim() : "";
}

function writePagesWorker(apiKey: string) {
  writeFileSync(PUBLIC_WORKER_PATH, buildPagesWorkerSource(apiKey), "utf8");
  writeFileSync(
    PUBLIC_KEY_STATUS_PATH,
    `${JSON.stringify({ hasBuildKey: Boolean(apiKey) })}\n`,
    "utf8",
  );
}

// Cloudflare Pages serves `out`. Chat cannot be a Next Route Handler there, so
// the build emits public/_worker.js → out/_worker.js (Advanced mode). Read the
// secret by computed name so Next cannot replace process.env.GEMINI_API_KEY
// with an empty compile-time value. Do not keep /functions: that mode ignores
// out/_worker.js and never receives the dashboard secret.
if (isCloudflarePages) {
  rmSync(path.join(process.cwd(), "src/app/api"), { recursive: true, force: true });
  rmSync(path.join(process.cwd(), "functions"), { recursive: true, force: true });
  writePagesWorker(readBuildSecret(GEMINI_API_KEY_NAME));
}

const nextConfig: NextConfig = {
  output: isCloudflarePages ? "export" : undefined,
};

export default nextConfig;
