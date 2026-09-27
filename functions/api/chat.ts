import { handleChatPost } from "../../src/lib/genogram/chat";

type ChatFunctionEnv = {
  GEMINI_API_KEY?: string;
};

type ChatFunctionContext = {
  request: Request;
  env: ChatFunctionEnv;
};

export async function onRequestPost(context: ChatFunctionContext) {
  return handleChatPost(context.request, context.env.GEMINI_API_KEY);
}
