"use client";

import { XIcon } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Message,
  MessageContent,
  MessageResponse,
} from "@/components/ai-elements/message";
import {
  PromptInput,
  PromptInputFooter,
  PromptInputSubmit,
  PromptInputTextarea,
} from "@/components/ai-elements/prompt-input";
import { Shimmer } from "@/components/ai-elements/shimmer";
import { Button } from "@/components/ui/grok_app__components_ui__button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/grok_app__lib__utils";

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
};

type Props = {
  tabName: string;
  context: string;
  patientName: string;
  trendSummary?: string | null;
  trendLoading?: boolean;
  onClose: () => void;
};

export function DashboardChat({
  tabName,
  context,
  patientName,
  trendSummary,
  trendLoading,
  onClose,
}: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  // Seed the initial assistant message with the trend summary once it arrives
  useEffect(() => {
    if (!trendSummary) return;
    setMessages((prev) => {
      if (prev.length > 0) return prev;
      return [
        { id: "trend-summary", role: "assistant", content: trendSummary },
      ];
    });
  }, [trendSummary]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  });

  const send = useCallback(
    async (text: string) => {
      if (!text.trim() || loading) return;

      const userMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: "user",
        content: text.trim(),
      };
      setMessages((prev) => [...prev, userMsg]);
      setLoading(true);

      try {
        const history = [...messages, userMsg].map(({ role, content }) => ({
          role,
          content,
        }));

        const res = await fetch("/api/dashboard-chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messages: history, context, patientName }),
        });

        const data = (await res.json()) as { reply?: string; error?: string };
        const reply =
          data.reply ?? "Sorry, I couldn't get a response right now.";

        setMessages((prev) => [
          ...prev,
          { id: crypto.randomUUID(), role: "assistant", content: reply },
        ]);
      } catch {
        setMessages((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            role: "assistant",
            content: "Something went wrong. Please try again.",
          },
        ]);
      } finally {
        setLoading(false);
      }
    },
    [loading, messages, context, patientName],
  );

  return (
    <motion.aside
      initial={{ width: 0, opacity: 0 }}
      animate={{ width: 380, opacity: 1 }}
      exit={{ width: 0, opacity: 0 }}
      transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
      className="flex shrink-0 flex-col overflow-hidden border-l bg-card"
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b px-4 py-3">
        <div>
          <p className="text-sm font-semibold">Ask about {tabName}</p>
          <p className="text-sm text-muted-foreground">Powered by Grok</p>
        </div>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={onClose}
          aria-label="Close sidebar"
        >
          <XIcon className="size-4" />
        </Button>
      </div>

      {/* Messages */}
      <ScrollArea className="min-h-0 flex-1 px-4 py-3">
        {messages.length === 0 && (
          <p
            className={cn(
              "text-sm text-muted-foreground",
              trendLoading && "animate-pulse",
            )}
          >
            {trendLoading
              ? "Analyzing call history…"
              : `Ask me anything about the ${tabName} charts — I'll explain what they mean in plain language.`}
          </p>
        )}
        <div className="flex flex-col gap-3">
          <AnimatePresence initial={false}>
            {messages.map((msg) => (
              <motion.div
                key={msg.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2, ease: "easeOut" }}
              >
                <Message from={msg.role}>
                  <MessageContent>
                    {msg.role === "assistant" ? (
                      <MessageResponse>{msg.content}</MessageResponse>
                    ) : (
                      msg.content
                    )}
                  </MessageContent>
                </Message>
              </motion.div>
            ))}
          </AnimatePresence>
          {loading && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
            >
              <Message from="assistant">
                <MessageContent>
                  <Shimmer className="text-sm" duration={1.5}>
                    Thinking…
                  </Shimmer>
                </MessageContent>
              </Message>
            </motion.div>
          )}
        </div>
        <div ref={bottomRef} />
      </ScrollArea>

      {/* Input */}
      <div className="border-t p-3">
        <PromptInput
          onSubmit={({ text }) => send(text)}
          className={cn(loading && "opacity-60")}
        >
          <PromptInputTextarea
            placeholder="Ask about this tab…"
            className="min-h-10 max-h-32"
            disabled={loading}
          />
          <PromptInputFooter>
            <span />
            <PromptInputSubmit
              status={loading ? "submitted" : "ready"}
              disabled={loading}
            />
          </PromptInputFooter>
        </PromptInput>
      </div>
    </motion.aside>
  );
}
