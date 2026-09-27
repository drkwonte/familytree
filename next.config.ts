import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import type { NextConfig } from "next";
import { buildPagesFunctionSource } from "./src/lib/genogram/pages-worker";

const isCloudflarePages = process.env.CF_PAGES === "1";
const FUNCTION_CHAT_PATH = path.join(process.cwd(), "functions", "api", "chat.js");
const GEMINI_API_KEY_NAME = ["GEMINI", "API", "KEY"].join("_");

function readBuildSecret(name: string): string {
  const value = process.env[name];
  return typeof value === "string" ? value.trim() : "";
}

function writeChatFunction(apiKey: string) {
  mkdirSync(path.dirname(FUNCTION_CHAT_PATH), { recursive: true });
  writeFileSync(FUNCTION_CHAT_PATH, buildPagesFunctionSource(apiKey), "utf8");
}

// Static `out` cannot host a Next.js POST route. Cloudflare Pages already
// looks for /functions. Write that Function during the Pages build with the
// dashboard secret (available here as process.env) plus context.env at runtime.
if (isCloudflarePages) {
  rmSync(path.join(process.cwd(), "src/app/api"), { recursive: true, force: true });
  writeChatFunction(readBuildSecret(GEMINI_API_KEY_NAME));
}

const nextConfig: NextConfig = {
  output: isCloudflarePages ? "export" : undefined,
};

export default nextConfig;
