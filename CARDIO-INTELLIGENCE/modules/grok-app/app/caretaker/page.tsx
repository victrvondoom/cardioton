"use client";

import { AlertCircle, Send, UserRound, Wifi, WifiOff } from "lucide-react";
import { useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/grok_app__components_ui__badge";
import { Button } from "@/components/ui/grok_app__components_ui__button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/grok_app__components_ui__card";
import { Input } from "@/components/ui/grok_app__components_ui__input";
import { PhoneInput } from "@/components/ui/phone-input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/grok_app__components_ui__separator";

const SUGGESTIONS = [
  "Gently ask if they took their medication",
  "Ask about their family",
  "Check what day they think it is",
  "Ask how they slept",
  "Steer toward something happy they enjoy",
  "Start gently wrapping up the call",
];

type SentNote = { id: string; text: string; live: boolean; at: number };

export default function CaretakerPage() {
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState<SentNote[]>([]);
  const [error, setError] = useState<string | null>(null);

  const connected = phone.trim().length > 3;

  async function send(note: string) {
    const value = note.trim();
    if (!value || !connected) return;
    setSending(true);
    setError(null);
    try {
      const res = await fetch("/api/guidance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, name, text: value }),
      });
      const data = (await res.json()) as { live?: boolean; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Failed to send");
      setSent((prev) => [
        {
          id: crypto.randomUUID(),
          text: value,
          live: !!data.live,
          at: Date.now(),
        },
        ...prev,
      ]);
      setText("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to send");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="flex flex-1 min-h-0 gap-4 px-8 py-4">
      <div className="flex w-80 shrink-0 flex-col gap-4">
        <div>
          <div className="mb-1 flex items-center gap-2">
            <UserRound className="size-5" />
            <h1 className="text-lg font-semibold tracking-tight">Caretaker</h1>
          </div>
          <p className="text-sm text-muted-foreground">
            Quietly guide the conversation. Your suggestions steer the
            assistant&apos;s next reply — the person on the call never hears
            them or knows you&apos;re here.
          </p>
        </div>

        <Card size="sm">
          <CardHeader>
            <CardTitle>Who are you guiding?</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            <PhoneInput value={phone.replace(/^\+1/, "")} onChange={setPhone} />
            <Input
              placeholder="Their name (optional)"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
              {connected ? (
                <>
                  <Wifi className="size-4 text-green-600" /> Ready to guide
                </>
              ) : (
                <>
                  <WifiOff className="size-4" /> Enter their phone number to
                  begin
                </>
              )}
            </span>
          </CardContent>
        </Card>

        <Card size="sm" className="flex-1 min-h-0 flex flex-col">
          <CardHeader>
            <CardTitle>Quick suggestions</CardTitle>
            <CardDescription>Tap to send instantly</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {SUGGESTIONS.map((s) => (
              <Button
                key={s}
                variant="outline"
                size="sm"
                disabled={!connected || sending}
                onClick={() => send(s)}
                className="h-auto justify-start whitespace-normal py-2 text-left"
              >
                {s}
              </Button>
            ))}
          </CardContent>
        </Card>
      </div>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-4">
        <Card className="flex min-h-0 flex-1 flex-col">
          <CardHeader>
            <CardTitle>Sent notes</CardTitle>
            <CardDescription>
              {sent.length === 0
                ? "Notes you send will appear here."
                : `${sent.length} note${sent.length === 1 ? "" : "s"} sent this session`}
            </CardDescription>
          </CardHeader>
          <Separator />
          <CardContent className="flex-1 min-h-0 p-0">
            <ScrollArea className="h-full">
              <div className="flex flex-col gap-2 p-6">
                {sent.length === 0 ? (
                  <p className="py-8 text-center text-sm text-muted-foreground">
                    No notes sent yet.
                  </p>
                ) : (
                  sent.map((n) => (
                    <div
                      key={n.id}
                      className="flex items-start gap-3 rounded-2xl border border-border bg-muted/30 px-4 py-3"
                    >
                      <span className="flex-1 text-sm">{n.text}</span>
                      <Badge
                        variant={n.live ? "default" : "outline"}
                        className="shrink-0"
                      >
                        {n.live ? "delivered" : "no live call"}
                      </Badge>
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>
          </CardContent>
          <Separator />
          <CardFooter className="gap-2 py-4">
            <Input
              value={text}
              disabled={!connected || sending}
              placeholder="Whisper a suggestion…"
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") send(text);
              }}
              className="flex-1"
            />
            <Button
              onClick={() => send(text)}
              disabled={!connected || sending || !text.trim()}
            >
              <Send className="size-4" />
              Send
            </Button>
          </CardFooter>
        </Card>

        {error && (
          <Alert variant="destructive">
            <AlertCircle className="size-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
      </div>
    </div>
  );
}
