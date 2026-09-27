import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import type { NextConfig } from "next";
import { buildPagesFunctionSource, buildPagesWorkerSource } from "./src/lib/genogram/pages-worker";

const isCloudflarePages = process.env.CF_PAGES === "1";
const PUBLIC_WORKER_PATH = path.join(process.cwd(), "public", "_worker.js");
const PUBLIC_KEY_STATUS_PATH = path.join(process.cwd(), "public", "cf-key-status.json");
const FUNCTION_CHAT_PATH = path.join(process.cwd(), "functions", "api", "chat.js");
const GEMINI_API_KEY_NAME = ["GEMINI", "API", "KEY"].join("_");

function readBuildSecret(name: string): string {
  const value = process.env[name];
  return typeof value === "string" ? value.trim() : "";
}

function writePagesRuntime(apiKey: string) {
  mkdirSync(path.dirname(FUNCTION_CHAT_PATH), { recursive: true });
  writeFileSync(FUNCTION_CHAT_PATH, buildPagesFunctionSource(apiKey), "utf8");
  writeFileSync(PUBLIC_WORKER_PATH, buildPagesWorkerSource(apiKey), "utf8");
  writeFileSync(
    PUBLIC_KEY_STATUS_PATH,
    `${JSON.stringify({ hasBuildKey: Boolean(apiKey) })}\n`,
    "utf8",
  );
}

// Cloudflare Pages serves `out`. Some requests hit Advanced mode `_worker.js`,
// others still hit leftover /functions. Write the same baked key into both so
// either path can call Gemini. Read the secret by computed name so Next cannot
// replace process.env.GEMINI_API_KEY with an empty compile-time value.
if (isCloudflarePages) {
  rmSync(path.join(process.cwd(), "src/app/api"), { recursive: true, force: true });
  writePagesRuntime(readBuildSecret(GEMINI_API_KEY_NAME));
}

const nextConfig: NextConfig = {
  output: isCloudflarePages ? "export" : undefined,
};

export default nextConfig;
