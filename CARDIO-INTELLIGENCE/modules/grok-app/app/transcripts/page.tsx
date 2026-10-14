"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/grok_app__components_ui__badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { TranscriptDetailRow, TranscriptListRow } from "@/lib/db/kpis";
import { storage } from "@/lib/storage";

const moodVariant: Record<
  string,
  "default" | "secondary" | "destructive" | "outline"
> = {
  Cheerful: "default",
  Neutral: "secondary",
  Flat: "outline",
  Anxious: "destructive",
  Agitated: "destructive",
};

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function ConversationPreview({
  transcript,
  patientName,
  companionName,
}: {
  transcript: string;
  patientName: string | null;
  companionName: string;
}) {
  const lines = transcript.split("\n").filter(Boolean);

  return (
    <div className="flex flex-col gap-3">
      {lines.map((line, i) => {
        const colonIdx = line.indexOf(": ");
        if (colonIdx === -1) {
          return (
            <p key={`${i}-${line}`} className="text-sm text-muted-foreground">
              {line}
            </p>
          );
        }
        const speaker = line.slice(0, colonIdx);
        const text = line.slice(colonIdx + 2);
        const isPatient =
          patientName != null &&
          speaker.toLowerCase() === patientName.toLowerCase();
        const displayName = isPatient ? speaker : companionName;

        return (
          <div
            key={`${i}-${line}`}
            className={`flex flex-col gap-0.5 ${isPatient ? "items-end" : "items-start"}`}
          >
            <span className="px-1 text-sm font-medium text-muted-foreground">
              {displayName}
            </span>
            <div
              className={`max-w-[75%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                isPatient
                  ? "rounded-tr-sm bg-muted text-foreground"
                  : "rounded-tl-sm bg-blue-600 text-white dark:bg-blue-700"
              }`}
            >
              {text}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function TranscriptsPage() {
  const [rows, setRows] = useState<TranscriptListRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<TranscriptDetailRow | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [companionName] = useState(() =>
    typeof window === "undefined" ? "Cora" : storage.getCompanionName(),
  );

  useEffect(() => {
    const phone = storage.getPhone();
    const name = storage.getName();

    fetch("/api/transcripts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        phone,
        name,
        patientId: phone ? undefined : "mary-demo",
      }),
    })
      .then((r) => r.json())
      .then((d) => setRows(d.rows ?? []))
      .catch(() => setRows([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!selectedId) return;
    setDetailLoading(true);
    setDetail(null);
    fetch(`/api/transcripts/${selectedId}`)
      .then((r) => r.json())
      .then((d) => setDetail(d))
      .catch(() => setDetail(null))
      .finally(() => setDetailLoading(false));
  }, [selectedId]);

  return (
    <main className="flex min-h-0 flex-1 overflow-hidden">
      <div className="flex w-80 shrink-0 flex-col border-r">
        <div className="shrink-0 border-b px-8 py-3">
          <h1 className="text-base font-semibold">Call Transcripts</h1>
          <p className="text-sm text-muted-foreground">
            {loading
              ? "Loading…"
              : `${rows.length} call${rows.length === 1 ? "" : "s"}`}
          </p>
        </div>
        <ScrollArea className="min-h-0 flex-1">
          {loading ? (
            <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">
              Loading transcripts…
            </div>
          ) : rows.length === 0 ? (
            <div className="flex h-40 items-center justify-center px-6 text-center text-sm text-muted-foreground">
              No calls recorded yet. Complete a call to see transcripts here.
            </div>
          ) : (
            <div className="flex flex-col divide-y">
              {rows.map((row) => (
                <button
                  type="button"
                  key={row.id}
                  onClick={() => setSelectedId(row.id)}
                  className={`flex w-full flex-col gap-1.5 px-8 py-3 text-left transition-colors hover:bg-muted/50 ${
                    selectedId === row.id ? "bg-muted" : ""
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium">
                      {formatDate(row.call_date)}
                    </span>
                    <div className="flex gap-1">
                      {row.safety_flag && (
                        <Badge
                          variant="destructive"
                          className="text-sm px-1.5 py-0"
                        >
                          Safety
                        </Badge>
                      )}
                      {row.mood && (
                        <Badge
                          variant={moodVariant[row.mood] ?? "outline"}
                          className="text-sm px-1.5 py-0"
                        >
                          {row.mood}
                        </Badge>
                      )}
                    </div>
                  </div>
                  {row.patient_name && (
                    <span className="text-sm text-muted-foreground">
                      {row.patient_name}
                    </span>
                  )}
                  {row.summary && (
                    <p className="line-clamp-2 text-sm text-muted-foreground">
                      {row.summary}
                    </p>
                  )}
                </button>
              ))}
            </div>
          )}
        </ScrollArea>
      </div>

      <div className="flex min-w-0 flex-1 flex-col">
        {!selectedId ? (
          <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
            Select a call to preview the conversation.
          </div>
        ) : detailLoading ? (
          <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
            Loading transcript…
          </div>
        ) : detail ? (
          <>
            <div className="shrink-0 border-b px-8 py-3">
              <div className="flex items-center gap-3">
                <h2 className="text-base font-semibold">
                  {formatDate(detail.call_date)}
                  {` — ${companionName}`}
                  {detail.patient_name ? ` & ${detail.patient_name}` : ""}
                </h2>
                <div className="flex gap-1.5">
                  {detail.safety_flag && (
                    <Badge variant="destructive">Safety flag</Badge>
                  )}
                  {detail.mood && (
                    <Badge variant={moodVariant[detail.mood] ?? "outline"}>
                      {detail.mood}
                    </Badge>
                  )}
                </div>
              </div>
              {detail.summary && (
                <p className="mt-1 text-sm text-muted-foreground">
                  {detail.summary}
                </p>
              )}
            </div>
            <ScrollArea className="min-h-0 flex-1 px-8 py-4">
              {detail.transcript ? (
                <ConversationPreview
                  transcript={detail.transcript}
                  patientName={detail.patient_name}
                  companionName={companionName}
                />
              ) : (
                <p className="text-sm text-muted-foreground">
                  No transcript was saved for this call.
                </p>
              )}
            </ScrollArea>
          </>
        ) : (
          <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
            Failed to load transcript.
          </div>
        )}
      </div>
    </main>
  );
}
