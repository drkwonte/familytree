"use client";

import { ArrowUp } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { applyChatChanges } from "@/lib/genogram/chat-changes";
import { requestChatChanges } from "@/lib/genogram/chat-client";
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
      const reply = await requestChatChanges(trimmed, graph);
      if (!reply.ok) {
        reportFailure(reply.error);
        return;
      }
      // Applied to the graph as it is now, so edits made while the model was thinking survive.
      const applied = applyChatChanges(useFamilyStore.getState().graph, reply.changes);
      const note = [reply.assistantMessage, ...reply.problems, ...applied.problems].join("\n");
      if (applied.graph === useFamilyStore.getState().graph) {
        appendChat({ id: crypto.randomUUID(), role: "assistant", content: note });
      } else {
        replaceGraph(applied.graph, note);
      }
    } finally {
      setThinking(false);
    }
  }

  function reportFailure(text: string) {
    setError(text);
    appendChat({ id: crypto.randomUUID(), role: "assistant", content: `반영하지 못했습니다. ${text}` });
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
                  : "mr-8 whitespace-pre-line rounded-lg bg-muted px-3 py-2 text-sm"
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
            placeholder="예: 인물1과 인물2 사이에 갈등 표시해줘. 인물5와 인물7 사이에 단절 표시해줘."
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
