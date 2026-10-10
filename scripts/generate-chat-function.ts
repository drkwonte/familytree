import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { buildChatFunctionSource, CHAT_FUNCTION_PATH } from "../src/lib/genogram/chat-function-source";

const outputPath = path.join(process.cwd(), CHAT_FUNCTION_PATH);
mkdirSync(path.dirname(outputPath), { recursive: true });
writeFileSync(outputPath, buildChatFunctionSource(), "utf8");
console.log(`Wrote ${CHAT_FUNCTION_PATH}`);
