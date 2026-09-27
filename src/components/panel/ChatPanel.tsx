"use client";

import { ArrowUp } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useFamilyStore } from "@/store/family-store";

export function ChatPanel() {
  const graph = useFamilyStore((state) => state.graph);
  const chat = useFamilyStore((state) => state.chat);
  const isThinking = useFamilyStore((state) => state.isThinking);
  const appendChat = useFamilyStore((state) => state.appendChat);
  const replaceGraph = useFamilyStore((state) => state.replaceGraph);
  const setThinking = useFamilyStore((state) => state.setThinking);
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const canSend = Boolean(message.trim()) && !isThinking;

  async function handleSend() {
    const trimmed = message.trim();
    if (!trimmed || isThinking) return;
    setError(null);
    appendChat({ id: crypto.randomUUID(), role: "user", content: trimmed });
    setMessage("");
    setThinking(true);
    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: trimmed, graph }),
      });
      const payload = (await response.json()) as {
        error?: string;
        assistantMessage?: string;
        graph?: typeof graph;
      };
      if (!response.ok || !payload.graph) {
        throw new Error(payload.error ?? "요청에 실패했습니다.");
      }
      replaceGraph(payload.graph, payload.assistantMessage ?? "가계도를 반영했습니다.");
    } catch (cause) {
      const text = cause instanceof Error ? cause.message : "알 수 없는 오류";
      setError(text);
      appendChat({
        id: crypto.randomUUID(),
        role: "assistant",
        content: `반영하지 못했습니다. ${text}`,
      });
    } finally {
      setThinking(false);
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden">
      <div className="min-h-0 flex-1 overflow-auto rounded-xl border bg-card px-3 py-2">
        <div className="grid gap-2">
          {chat.map((turn) => (
            <div
              key={turn.id}
              className={
                turn.role === "user"
                  ? "ml-8 rounded-lg bg-primary px-3 py-2 text-sm text-primary-foreground"
                  : "mr-8 rounded-lg bg-muted px-3 py-2 text-sm"
              }
            >
              {turn.content}
            </div>
          ))}
          {isThinking ? <p className="text-xs text-muted-foreground">가계도를 해석하는 중…</p> : null}
        </div>
      </div>
      <div className="shrink-0">
        <div className="relative">
          <Textarea
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            placeholder="예: 아버지와 나는 단절이야. 아버지는 만성 우울증을 앓고 계셔."
            className="min-h-24 resize-none pb-12 pr-12"
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                void handleSend();
              }
            }}
          />
          <Button
            type="button"
            size="icon-sm"
            className="absolute right-2 bottom-2 rounded-full"
            aria-label="보내기"
            disabled={!canSend}
            onClick={() => void handleSend()}
          >
            <ArrowUp />
          </Button>
        </div>
        {error ? <p className="mt-2 text-xs text-destructive">{error}</p> : null}
      </div>
    </div>
  );
}
