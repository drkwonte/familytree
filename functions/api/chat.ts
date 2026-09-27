import { handleChatPost, readGeminiApiKey } from "../../src/lib/genogram/chat";
import { BUILD_TIME_GEMINI_API_KEY } from "../runtime-env";

type ChatFunctionEnv = {
  GEMINI_API_KEY?: string;
};

type ChatFunctionContext = {
  request: Request;
  env: ChatFunctionEnv;
};

export async function onRequestPost(context: ChatFunctionContext) {
  const apiKey = readGeminiApiKey(context.env?.GEMINI_API_KEY, BUILD_TIME_GEMINI_API_KEY);
  return handleChatPost(context.request, apiKey);
}
