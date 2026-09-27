import { GoogleGenAI } from "@google/genai";
import { NextResponse } from "next/server";
import { GEMINI_SYSTEM_PROMPT } from "@/lib/genogram/gemini-prompt";
import type { FamilyGraph } from "@/lib/genogram/types";

const GEMINI_MODEL = "gemini-3.8-flash";

type ChatRequest = {
  message: string;
  graph: FamilyGraph;
};

export async function POST(request: Request) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "GEMINI_API_KEY가 없습니다. .env.local에 키를 넣어 주세요." },
      { status: 500 },
    );
  }

  const body = (await request.json()) as ChatRequest;
  if (!body.message?.trim()) {
    return NextResponse.json({ error: "메시지를 입력해 주세요." }, { status: 400 });
  }

  const ai = new GoogleGenAI({ apiKey });
  const response = await ai.models.generateContent({
    model: GEMINI_MODEL,
    contents: [
      {
        role: "user",
        parts: [
          {
            text: `${GEMINI_SYSTEM_PROMPT}\n\n현재 가계도 JSON:\n${JSON.stringify(body.graph)}\n\n사용자 요청:\n${body.message}`,
          },
        ],
      },
    ],
    config: {
      responseMimeType: "application/json",
    },
  });

  const text = response.text;
  if (!text) {
    return NextResponse.json({ error: "모델 응답이 비었습니다." }, { status: 502 });
  }

  try {
    const parsed = JSON.parse(text) as {
      assistantMessage?: string;
      graph?: FamilyGraph;
    };
    if (!parsed.graph?.nodes || !parsed.graph.edges) {
      return NextResponse.json({ error: "그래프 형식이 올바르지 않습니다." }, { status: 502 });
    }
    return NextResponse.json({
      assistantMessage: parsed.assistantMessage ?? "가계도를 업데이트했습니다.",
      graph: {
        nodes: parsed.graph.nodes,
        edges: parsed.graph.edges,
        households: parsed.graph.households ?? [],
      },
    });
  } catch {
    return NextResponse.json({ error: "JSON 파싱에 실패했습니다." }, { status: 502 });
  }
}
