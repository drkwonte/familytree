import { handleChatPost } from "@/lib/genogram/chat";

export async function POST(request: Request) {
  return handleChatPost(request, process.env.GEMINI_API_KEY);
}
