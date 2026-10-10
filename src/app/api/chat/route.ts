import { readFileSync } from "node:fs";
import path from "node:path";
import { GEMINI_API_KEY_NAME, handleChatPost, parseEnvFileValue, readGeminiApiKey } from "@/lib/genogram/chat";

function readLocalEnvFile(): string | undefined {
  try {
    return readFileSync(path.join(process.cwd(), ".env.local"), "utf8");
  } catch {
    return undefined;
  }
}

export async function POST(request: Request) {
  const localFile = readLocalEnvFile();
  return handleChatPost(
    request,
    readGeminiApiKey(
      process.env[GEMINI_API_KEY_NAME],
      localFile ? parseEnvFileValue(localFile, GEMINI_API_KEY_NAME) : undefined,
    ),
  );
}
