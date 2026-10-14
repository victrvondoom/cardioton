"use client";

import {
  Activity,
  BrainCircuit,
  CheckCircle2,
  EarOff,
  ListChecks,
  Loader2,
  MessageSquare,
  Mic,
  MicOff,
  PhoneOff,
  Send,
  Sparkles,
  Wrench,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import type { PersonaState } from "@/components/ai-elements/persona";
import { Persona } from "@/components/ai-elements/persona";
import { Badge } from "@/components/ui/grok_app__components_ui__badge";
import { Button } from "@/components/ui/grok_app__components_ui__button";
import { Input } from "@/components/ui/grok_app__components_ui__input";
import { ROUTES } from "@/lib/grok_app__lib__routes";
import { cn } from "@/lib/grok_app__lib__utils";
import {
  type DebugEvent,
  type TranscriptEntry,
  useGrokVoice,
  type VoiceStatus,
} from "./use-grok-voice";

const STATUS_LABEL: Record<VoiceStatus, string> = {
  idle: "Not connected",
  connecting: "Connecting…",
  listening: "Listening",
  speaking: "Cora is speaking",
  error: "Error",
};

const STATUS_VARIANT: Record<
  VoiceStatus,
  "default" | "secondary" | "destructive" | "outline"
> = {
  idle: "outline",
  connecting: "secondary",
  listening: "default",
  speaking: "secondary",
  error: "destructive",
};

const VOICE_TO_PERSONA: Record<VoiceStatus, PersonaState> = {
  idle: "idle",
  connecting: "thinking",
  listening: "listening",
  speaking: "speaking",
  error: "idle",
};

type MobileTab = "persona" | "transcript" | "debug";

function MessageBubble({ entry }: { entry: TranscriptEntry }) {
  const isUser = entry.role === "user";
  return (
    <div
      className={cn(
        "flex flex-col gap-1",
        isUser ? "items-end" : "items-start",
      )}
    >
      <span className="px-1 text-xs text-muted-foreground">
        {isUser ? "You" : "Cora"}
      </span>
      <div
        className={cn(
          "max-w-[85%] whitespace-pre-wrap rounded-2xl px-3.5 py-2 text-sm",
          isUser
            ? "bg-primary text-primary-foreground"
            : "border border-border bg-background",
          !entry.final && "opacity-70",
        )}
      >
        {entry.text || "…"}
      </div>
    </div>
  );
}

function shortTime(at: number): string {
  return new Date(at).toLocaleTimeString([], {
    hour12: false,
    minute: "2-digit",
    second: "2-digit",
  });
}

function KpiResult({ result }: { result: unknown }) {
  const r = (result ?? {}) as Record<string, unknown>;
  const fields: Array<[string, string]> = [];
  const add = (label: string, v: unknown) => {
    if (v !== null && v !== undefined && v !== "")
      fields.push([label, String(v)]);
  };
  add("mood", r.mood);
  add("sleep", r.sleep_quality);
  add("fluency", r.fluency_count);
  add("naming", r.naming_accuracy);
  add("word-find fails", r.word_finding_failures);
  add("immediate recall", r.immediate_recall);
  add("delayed words", r.delayed_recall_words);
  add("story details", r.story_recall_details);
  add("orientation", r.orientation_score);
  add("stop-word frac", r.stop_word_fraction);
  add("lexical div", r.lexical_diversity);
  add("repetition", r.repetition_count);
  add("medication", r.medication_status);
  add("x-session recall", r.cross_session_recall);
  add("safety", r.safety_flag);

  const observations = Array.isArray(r.observations_json)
    ? (r.observations_json as string[])
    : [];

  return (
    <div className="flex flex-col gap-2">
      {r.summary ? (
        <p className="text-xs text-foreground">{String(r.summary)}</p>
      ) : null}
      <div className="flex flex-wrap gap-1">
        {fields.map(([label, value]) => (
          <span
            key={label}
            className="inline-flex items-center gap-1 rounded-md bg-muted px-1.5 py-0.5 font-mono text-[11px]"
          >
            <span className="text-muted-foreground">{label}</span>
            <span className="font-semibold">{value}</span>
          </span>
        ))}
      </div>
      {observations.length > 0 ? (
        <ul className="ml-1 list-disc pl-4 text-[11px] text-muted-foreground">
          {observations.map((o) => (
            <li key={o}>{o}</li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function DebugEventRow({ event }: { event: DebugEvent }) {
  if (event.kind === "tool") {
    const memories =
      event.result && typeof event.result === "object"
        ? ((event.result as { memories?: string[] }).memories ?? null)
        : null;
    return (
      <div className="flex flex-col gap-1 rounded-lg border border-border bg-background px-3 py-2">
        <div className="flex items-center gap-2 text-xs">
          <Wrench className="size-3.5 text-muted-foreground" />
          <span className="font-mono font-semibold">{event.name}</span>
          <span className="font-mono text-muted-foreground">
            {JSON.stringify(event.args)}
          </span>
          <span className="ml-auto text-[11px] text-muted-foreground">
            {event.status === "running" ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              shortTime(event.at)
            )}
          </span>
        </div>
        {event.status !== "running" ? (
          memories ? (
            memories.length > 0 ? (
              <ul className="ml-1 list-disc pl-4 text-[11px] text-muted-foreground">
                {memories.map((m) => (
                  <li key={m}>{m}</li>
                ))}
              </ul>
            ) : (
              <p className="pl-5 text-[11px] text-muted-foreground italic">
                no memories found
              </p>
            )
          ) : (
            <pre className="overflow-x-auto pl-5 text-[11px] text-muted-foreground">
              {JSON.stringify(event.result)}
            </pre>
          )
        ) : null}
      </div>
    );
  }

  if (event.kind === "guidance") {
    return (
      <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2">
        <EarOff className="mt-0.5 size-3.5 shrink-0 text-amber-600" />
        <div className="flex flex-col gap-0.5">
          <span className="text-[11px] font-semibold text-amber-700 dark:text-amber-500">
            Caretaker guidance (silent)
          </span>
          <span className="text-xs text-foreground">{event.text}</span>
        </div>
        <span className="ml-auto text-[11px] text-muted-foreground">
          {shortTime(event.at)}
        </span>
      </div>
    );
  }

  if (event.kind === "agenda") {
    return (
      <div className="flex items-start gap-2 rounded-lg border border-sky-500/30 bg-sky-500/10 px-3 py-2">
        <ListChecks className="mt-0.5 size-3.5 shrink-0 text-sky-600" />
        <div className="flex flex-col gap-0.5">
          <span className="text-[11px] font-semibold text-sky-700 dark:text-sky-500">
            Agenda beat: {event.beat} (silent)
          </span>
          <span className="text-xs text-foreground">{event.text}</span>
        </div>
        <span className="ml-auto text-[11px] text-muted-foreground">
          {shortTime(event.at)}
        </span>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1.5 rounded-lg border border-border bg-background px-3 py-2">
      <div className="flex items-center gap-2 text-xs">
        <BrainCircuit className="size-3.5 text-muted-foreground" />
        <span className="font-semibold">KPI extraction</span>
        <span className="ml-auto inline-flex items-center gap-1 text-[11px] text-muted-foreground">
          {event.status === "extracting" ? (
            <>
              <Loader2 className="size-3.5 animate-spin" /> extracting…
            </>
          ) : event.status === "done" ? (
            <>
              <CheckCircle2 className="size-3.5 text-green-600" /> done
            </>
          ) : (
            "timed out"
          )}
        </span>
      </div>
      {event.status === "done" ? <KpiResult result={event.result} /> : null}
      {event.status === "timeout" ? (
        <p className="text-[11px] text-muted-foreground">
          No KPI row appeared in time (extraction may still be processing).
        </p>
      ) : null}
    </div>
  );
}

function TranscriptContent({
  transcript,
  isLive,
}: {
  transcript: TranscriptEntry[];
  isLive: boolean;
}) {
  return (
    <Conversation className="min-h-0 flex-1 rounded-xl border border-border bg-muted/30">
      <ConversationContent className="gap-3">
        {transcript.length === 0 ? (
          <p className="m-auto text-sm text-muted-foreground">
            {isLive ? "Listening…" : "Start a call to begin."}
          </p>
        ) : (
          transcript.map((entry) => (
            <MessageBubble key={entry.id} entry={entry} />
          ))
        )}
      </ConversationContent>
      <ConversationScrollButton />
    </Conversation>
  );
}

function DebugContent({ events }: { events: DebugEvent[] }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  });

  return (
    <div className="min-h-0 flex-1 flex flex-col rounded-xl border border-border bg-muted/20">
      <div
        ref={scrollRef}
        className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto p-3"
      >
        {events.length === 0 ? (
          <p className="m-auto text-xs text-muted-foreground">
            Tool calls and KPI extraction will appear here.
          </p>
        ) : (
          events.map((e) => <DebugEventRow key={e.id} event={e} />)
        )}
      </div>
    </div>
  );
}

const CARETAKER_SUGGESTIONS = [
  "Gently ask if they took their medication",
  "Ask about their family",
  "Check what day they think it is",
  "Start gently wrapping up the call",
];

/**
 * Same-screen caretaker console. Anything sent here silently steers Cora's next
 * reply — the patient never hears it. (For a real second device, the /caretaker
 * page feeds the same channel.)
 */
function CaretakerBar({
  onSend,
  disabled,
}: {
  onSend: (text: string) => void;
  disabled: boolean;
}) {
  const [text, setText] = useState("");

  const submit = () => {
    const v = text.trim();
    if (!v) return;
    onSend(v);
    setText("");
  };

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-amber-500/30 bg-amber-500/5 px-3 py-2.5">
      <div className="flex items-center gap-1.5 text-xs font-medium text-amber-700 dark:text-amber-500">
        <EarOff className="size-3.5" />
        Caretaker — private guidance (the patient can't hear this)
      </div>
      <div className="flex flex-wrap gap-1.5">
        {CARETAKER_SUGGESTIONS.map((s) => (
          <button
            key={s}
            type="button"
            disabled={disabled}
            onClick={() => onSend(s)}
            className="rounded-full border border-amber-500/40 bg-background px-2.5 py-1 text-[11px] text-foreground transition-colors hover:bg-amber-500/10 disabled:opacity-50"
          >
            {s}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-2">
        <Input
          value={text}
          disabled={disabled}
          placeholder={
            disabled ? "Start a call to guide Cora…" : "Whisper a suggestion…"
          }
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") submit();
          }}
          className="h-8 rounded-md text-sm"
        />
        <Button size="sm" onClick={submit} disabled={disabled || !text.trim()}>
          <Send className="size-3.5" />
          Send
        </Button>
      </div>
    </div>
  );
}

function PersonaCenter({
  status,
  isLive,
  connect,
  disconnect,
  toolActivity,
  error,
  muted,
  toggleMute,
  hasEnded,
}: {
  status: VoiceStatus;
  isLive: boolean;
  connect: () => void;
  disconnect: () => void;
  toolActivity: string | null;
  error: string | null;
  muted: boolean;
  toggleMute: () => void;
  hasEnded: boolean;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-6 min-h-0 flex-1">
      <Persona
        className="size-64 md:size-80"
        state={VOICE_TO_PERSONA[status]}
        variant="halo"
      />

      <div className="flex flex-col items-center gap-3">
        {!isLive ? (
          <div className="flex flex-col items-center gap-3">
            <Button
              size="lg"
              onClick={connect}
              disabled={status === "connecting"}
            >
              {status === "connecting" ? (
                <Loader2 className="animate-spin" />
              ) : (
                <Mic />
              )}
              {status === "connecting"
                ? "Connecting"
                : hasEnded
                  ? "Start another call"
                  : "Start call"}
            </Button>
            {hasEnded ? (
              <Button asChild size="lg" variant="secondary">
                <Link href={ROUTES.dashboard}>
                  <Activity />
                  View dashboard
                </Link>
              </Button>
            ) : null}
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <Button
              size="lg"
              variant={muted ? "default" : "outline"}
              onClick={toggleMute}
              aria-pressed={muted}
            >
              {muted ? <MicOff /> : <Mic />}
              {muted ? "Muted" : "Mute"}
            </Button>
            <Button size="lg" variant="destructive" onClick={disconnect}>
              <PhoneOff />
              End call
            </Button>
          </div>
        )}

        <Badge variant={STATUS_VARIANT[status]}>{STATUS_LABEL[status]}</Badge>

        {toolActivity ? (
          <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
            <Wrench className="size-3.5 animate-pulse" />
            {toolActivity}
          </span>
        ) : null}
      </div>

      {error ? (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive max-w-xs text-center">
          {error}
        </div>
      ) : null}
    </div>
  );
}

export default function CallPage() {
  const {
    status,
    error,
    transcript,
    toolActivity,
    debugEvents,
    muted,
    connect,
    disconnect,
    toggleMute,
    sendGuidance,
  } = useGrokVoice();
  const isLive = status === "listening" || status === "speaking";
  const [mobileTab, setMobileTab] = useState<MobileTab>("persona");
  // A call has ended once we're back to idle but a transcript was produced —
  // that's when we surface the "View dashboard" path.
  const hasEnded = !isLive && status !== "connecting" && transcript.length > 0;

  return (
    <>
      {/* ── Desktop: three-column layout ── */}
      <div className="hidden md:grid md:grid-cols-3 md:gap-4 md:p-6 h-[calc(100svh-3.5rem)]">
        <div className="flex min-h-0 flex-col gap-2">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider px-1">
            Transcript
          </p>
          <TranscriptContent transcript={transcript} isLive={isLive} />
        </div>

        <PersonaCenter
          status={status}
          isLive={isLive}
          connect={connect}
          disconnect={disconnect}
          toolActivity={toolActivity}
          error={error}
          muted={muted}
          toggleMute={toggleMute}
          hasEnded={hasEnded}
        />

        <div className="flex min-h-0 flex-col gap-2">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider px-1">
            Debug
          </p>
          <DebugContent events={debugEvents} />
          <CaretakerBar onSend={sendGuidance} disabled={!isLive} />
        </div>
      </div>

      {/* ── Mobile: tab-switched single column ── */}
      <div className="flex md:hidden flex-col h-[calc(100svh-3.5rem)]">
        {/* Tab content */}
        <div className="flex min-h-0 flex-1 flex-col gap-2 p-4 pb-0">
          {mobileTab === "persona" && (
            <PersonaCenter
              status={status}
              isLive={isLive}
              connect={connect}
              disconnect={disconnect}
              toolActivity={toolActivity}
              error={error}
              muted={muted}
              toggleMute={toggleMute}
              hasEnded={hasEnded}
            />
          )}
          {mobileTab === "transcript" && (
            <TranscriptContent transcript={transcript} isLive={isLive} />
          )}
          {mobileTab === "debug" && (
            <>
              <DebugContent events={debugEvents} />
              <CaretakerBar onSend={sendGuidance} disabled={!isLive} />
            </>
          )}
        </div>

        {/* Bottom tab bar */}
        <div className="shrink-0 border-t border-border bg-background">
          <div className="grid grid-cols-3">
            {(
              [
                { id: "persona", label: "Cora", icon: Sparkles },
                { id: "transcript", label: "Transcript", icon: MessageSquare },
                { id: "debug", label: "Debug", icon: Activity },
              ] as const
            ).map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                type="button"
                onClick={() => setMobileTab(id)}
                className={cn(
                  "flex flex-col items-center gap-1 py-3 text-xs transition-colors",
                  mobileTab === id
                    ? "text-foreground"
                    : "text-muted-foreground",
                )}
              >
                <Icon
                  className={cn("size-5", mobileTab === id && "stroke-[2.5]")}
                />
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
