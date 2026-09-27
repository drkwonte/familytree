import { rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import type { NextConfig } from "next";

const isCloudflarePages = process.env.CF_PAGES === "1";
const FUNCTION_RUNTIME_ENV_PATH = path.join(process.cwd(), "functions", "runtime-env.ts");

function writeFunctionRuntimeEnv(apiKey: string) {
  writeFileSync(
    FUNCTION_RUNTIME_ENV_PATH,
    [
      "// Generated during the Cloudflare Pages build. Do not commit a real key.",
      `export const BUILD_TIME_GEMINI_API_KEY = ${JSON.stringify(apiKey)};`,
      "",
    ].join("\n"),
    "utf8",
  );
}

// Cloudflare Pages serves the static `out` folder. A POST Route Handler cannot
// be statically exported, so the production chat API lives in functions/api.
// Dashboard env vars are available at build time; copy the key into the
// Function bundle (never into `out`) so the runtime can call Gemini.
if (isCloudflarePages) {
  rmSync(path.join(process.cwd(), "src/app/api"), { recursive: true, force: true });
  writeFunctionRuntimeEnv(process.env.GEMINI_API_KEY ?? "");
}

const nextConfig: NextConfig = {
  output: isCloudflarePages ? "export" : undefined,
};

export default nextConfig;
