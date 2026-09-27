import { rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import type { NextConfig } from "next";
import { buildPagesWorkerSource } from "./src/lib/genogram/pages-worker";

const isCloudflarePages = process.env.CF_PAGES === "1";
const PUBLIC_WORKER_PATH = path.join(process.cwd(), "public", "_worker.js");

function writePagesWorker(apiKey: string) {
  writeFileSync(PUBLIC_WORKER_PATH, buildPagesWorkerSource(apiKey), "utf8");
}

// Cloudflare Pages serves the static `out` folder. The chat API cannot live in a
// Next.js Route Handler there, so the build emits public/_worker.js and Next
// copies it to out/_worker.js (Pages Advanced mode). Dashboard secrets are on
// env.GEMINI_API_KEY at runtime; a build-time copy is only a fallback.
if (isCloudflarePages) {
  rmSync(path.join(process.cwd(), "src/app/api"), { recursive: true, force: true });
  writePagesWorker(process.env.GEMINI_API_KEY ?? "");
}

const nextConfig: NextConfig = {
  output: isCloudflarePages ? "export" : undefined,
};

export default nextConfig;
