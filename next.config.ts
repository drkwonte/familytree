import { rmSync } from "node:fs";
import path from "node:path";
import type { NextConfig } from "next";

const isCloudflarePages = process.env.CF_PAGES === "1";

// Cloudflare Pages serves the static `out` folder. A POST Route Handler cannot
// be statically exported, so the production chat API lives in functions/api.
if (isCloudflarePages) {
  rmSync(path.join(process.cwd(), "src/app/api"), { recursive: true, force: true });
}

const nextConfig: NextConfig = {
  output: isCloudflarePages ? "export" : undefined,
};

export default nextConfig;
