"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { storage } from "@/lib/storage";
import type { AgendaBeat } from "@/lib/voice/call-agenda";
import { buildCallInstructions } from "@/lib/voice/call-flow";
import { DEMO_PATIENT } from "@/lib/voice/patient-profile";
import { base64PCM16ToInt16, float32ToBase64PCM16 } from "@/lib/voice/pcm";
import { PCMPlayer } from "@/lib/voice/player";
import { runClientTool, voiceTools } from "@/lib/voice/tools";

const SAMPLE_RATE = 24000;
const MODEL = "grok-voice-think-fast-1.1";
const REALTIME_URL = `wss://api.x.ai/v1/realtime?model=${MODEL}`;

// Agenda pacing. Cora advances through the ordered clinical beats (see
// lib/voice/call-agenda.ts) on her own during natural lulls, so the call keeps
// moving instead of stalling in open-ended small talk.
//  - WARMUP: assistant turns of pure warmth before the first beat is injected.
//  - SPACING: minimum assistant turns between injected beats. The system prompt
//    now also self-drives the arc, so we keep the injected cues SPARSE — they're
//    a gentle backstop ensuring coverage/order, not a second engine racing the
//    prompt (which made transitions feel abrupt/forced).
const AGENDA_WARMUP_TURNS = 2;
const AGENDA_TURN_SPACING = 3;

// Fallback instructions (no memory) if the server doesn't return personalized
// ones. Normally /api/realtime-token returns memory-enriched instructions.
const FALLBACK_INSTRUCTIONS = buildCallInstructions(DEMO_PATIENT);

export type VoiceStatus =
  | "idle"
  | "connecting"
  | "listening"
  | "speaking"
  | "error";

export type TranscriptEntry = {
  id: string;
  role: "user" | "assistant";
  text: string;
  final: boolean;
};

/** A debug event surfaced in the /test panel for inspecting what's happening. */
export type DebugEvent =
  | {
      id: string;
      kind: "tool";
      at: number;
      name: string;
      args: Record<string, unknown>;
      status: "running" | "done" | "error";
      result?: unknown;
    }
  | {
      id: string;
      kind: "kpi";
      at: number;
      status: "extracting" | "done" | "timeout";
      result?: unknown;
    }
  | {
      id: string;
      kind: "guidance";
      at: number;
      text: string;
    }
  | {
      id: string;
      kind: "agenda";
      at: number;
      beat: string;
      text: string;
    };

type ServerEvent = {
  type: string;
  [key: string]: unknown;
};

export function useGrokVoice() {
  const [status, setStatus] = useState<VoiceStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([]);
  const [toolActivity, setToolActivity] = useState<string | null>(null);
  const [debugEvents, setDebugEvents] = useState<DebugEvent[]>([]);
  // When muted, we stop forwarding mic frames to the realtime API entirely, so
  // nothing the patient says is sent or transcribed until they unmute.
  const [muted, setMuted] = useState(false);
  const mutedRef = useRef(false);

  const pushDebug = useCallback((e: DebugEvent) => {
    setDebugEvents((prev) => [...prev, e]);
  }, []);
  const updateDebug = useCallback((id: string, patch: Partial<DebugEvent>) => {
    setDebugEvents((prev) =>
      prev.map((e) => (e.id === id ? ({ ...e, ...patch } as DebugEvent) : e)),
    );
  }, []);

  // Keep a ref mirror of the transcript for the disconnect handler.
  // biome-ignore lint/correctness/useExhaustiveDependencies: ref sync only
  useEffect(() => {
    transcriptRef.current = transcript;
  }, [transcript]);

  const wsRef = useRef<WebSocket | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const playerRef = useRef<PCMPlayer | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  // Live caretaker guidance channel (cross-device, via SSE).
  const guidanceSourceRef = useRef<EventSource | null>(null);

  // Streaming-transcript accumulators.
  const assistantTextRef = useRef("");
  // Pending async tool executions for the current response turn.
  const pendingToolsRef = useRef<Promise<void>[]>([]);
  // True while the assistant is producing a response. We use this to decide
  // when a user's turn is truly finished: their bubble is only finalized once
  // the assistant starts replying, so mid-sentence pauses don't split it.
  const speakingRef = useRef(false);
  // True between the patient's speech_started and speech_stopped — so we don't
  // fire a proactive guidance response while they're mid-sentence.
  const userSpeakingRef = useRef(false);
  // Care-team guidance notes that haven't been acted on yet. Drained when we
  // proactively prompt Cora to weave them in (during a lull or after she
  // finishes her current turn).
  const pendingGuidanceRef = useRef<string[]>([]);
  // The ordered assessment agenda for this call (empty for the intro call). The
  // driver walks it during lulls so the conversation reliably progresses
  // through the clinical beats in the right order instead of stalling.
  const agendaRef = useRef<AgendaBeat[]>([]);
  // Index of the next agenda beat to inject.
  const agendaIndexRef = useRef(0);
  // Count of completed assistant turns, used to pace the agenda.
  const assistantTurnsRef = useRef(0);
  // The assistant-turn count at which we last injected an agenda beat.
  const lastProbeTurnRef = useRef(0);
  // The user's current turn. `grok-transcribe` sends CUMULATIVE transcripts
  // per conversation item (each update may restate/correct the whole item), so
  // we key by item id and REPLACE within an item, then join distinct items in
  // order. This avoids the "I had my tea... I had my tea and toast..." pile-up
  // from naively concatenating cumulative updates.
  const userItemsRef = useRef<Map<string, string>>(new Map());

  // Memory wiring. `instructionsRef` holds the (memory-enriched) system prompt
  // returned by the server. `transcriptRef` mirrors transcript state so the
  // disconnect handler can read the final turns. `callActiveRef` guards against
  // storing the same call twice (End click + ws.onclose both call disconnect).
  // `identityRef` carries the signed-up phone/name so live tools (recall) can
  // scope to the right person.
  const instructionsRef = useRef<string>(FALLBACK_INSTRUCTIONS);
  const transcriptRef = useRef<TranscriptEntry[]>([]);
  const callActiveRef = useRef(false);
  const identityRef = useRef<{ phone: string; name: string }>({
    phone: "",
    name: "",
  });
  // The latest KPI row id seen at call start, so we can detect when the
  // background pipeline writes a NEW one after this call ends.
  const baselineKpiIdRef = useRef<string | null>(null);

  const upsertStreaming = useCallback(
    (role: "user" | "assistant", text: string) => {
      setTranscript((prev) => {
        const last = prev[prev.length - 1];
        if (last && last.role === role && !last.final) {
          const next = prev.slice(0, -1);
          next.push({ ...last, text });
          return next;
        }
        return [...prev, { id: crypto.randomUUID(), role, text, final: false }];
      });
    },
    [],
  );

  const finalizeStreaming = useCallback(
    (role: "user" | "assistant", text?: string) => {
      setTranscript((prev) => {
        const idx = [...prev]
          .reverse()
          .findIndex((m) => m.role === role && !m.final);
        if (idx === -1) {
          if (text && text.trim()) {
            return [
              ...prev,
              { id: crypto.randomUUID(), role, text, final: true },
            ];
          }
          return prev;
        }
        const realIdx = prev.length - 1 - idx;
        const next = [...prev];
        next[realIdx] = {
          ...next[realIdx],
          text: text ?? next[realIdx].text,
          final: true,
        };
        return next;
      });
    },
    [],
  );

  // The full text of the user's current turn: distinct items joined in order.
  const renderUserTurn = useCallback(
    () =>
      [...userItemsRef.current.values()]
        .map((s) => s.trim())
        .filter(Boolean)
        .join(" "),
    [],
  );

  // Lock in the user's turn as a single finalized bubble and reset the
  // accumulators for the next turn.
  const finalizeUserTurn = useCallback(() => {
    const text = renderUserTurn();
    userItemsRef.current = new Map();
    if (text) finalizeStreaming("user", text);
  }, [finalizeStreaming, renderUserTurn]);

  const send = useCallback((message: object) => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
    }
  }, []);

  /** Toggle the mic. While muted, no audio frames reach the realtime API. */
  const toggleMute = useCallback(() => {
    setMuted((prev) => {
      const next = !prev;
      mutedRef.current = next;
      return next;
    });
  }, []);

  /**
   * Inject a private CARE-TEAM guidance note (e.g. from a caretaker). It is
   * added to the conversation as silent context (never spoken, never revealed),
   * then we proactively nudge Cora to weave it into her next turn:
   *  - If she's idle and the patient isn't mid-sentence, we fire a response NOW
   *    with a per-turn instruction to act on the note (so it doesn't get lost in
   *    a quiet lull — the failure mode where she just stays passive).
   *  - If she's mid-turn, it's queued and flushed when she finishes.
   * The patient never hears the note and never knows a third party is steering.
   */
  const maybeFlushGuidance = useCallback(() => {
    const notes = pendingGuidanceRef.current;
    if (notes.length === 0) return false;
    // Don't barge in while Cora is talking or the patient is mid-sentence —
    // those moments resolve and call us again (response.done / speech_stopped).
    if (speakingRef.current || userSpeakingRef.current) return false;

    pendingGuidanceRef.current = [];
    const joined = notes.join(" Also: ");
    send({
      type: "response.create",
      response: {
        instructions: `A private care-team note just came in: "${joined}". In your VERY NEXT thing you say, naturally and warmly act on it in your own words — gently steer the conversation that way now. Do NOT read the note aloud, do NOT mention a note or anyone else, and do NOT ask permission — just bring it up as your own friendly curiosity, in one short, natural turn.`,
      },
    });
    return true;
  }, [send]);

  /**
   * Advance the assessment agenda. When Cora has just gone idle and the patient
   * isn't mid-sentence, and enough warm turns have passed since the last probe,
   * we inject the next ordered beat as a SILENT private cue (never spoken). It
   * rides Cora's next reply, so the call keeps progressing through the clinical
   * beats in order instead of drifting in small talk. Care-team guidance always
   * takes priority over the agenda.
   */
  const maybeAdvanceAgenda = useCallback(() => {
    const beats = agendaRef.current;
    if (agendaIndexRef.current >= beats.length) return;
    // Don't inject while anyone's talking, or while a care-team note is pending.
    if (speakingRef.current || userSpeakingRef.current) return;
    if (pendingGuidanceRef.current.length > 0) return;
    // Pace it: a warm opening, then a free conversational turn between probes.
    const turns = assistantTurnsRef.current;
    if (turns < AGENDA_WARMUP_TURNS) return;
    if (turns - lastProbeTurnRef.current < AGENDA_TURN_SPACING) return;

    const beat = beats[agendaIndexRef.current];
    agendaIndexRef.current += 1;
    lastProbeTurnRef.current = turns;

    // Inject as silent context so it shapes Cora's NEXT turn (no barge-in).
    send({
      type: "conversation.item.create",
      item: {
        type: "message",
        role: "user",
        content: [
          {
            type: "input_text",
            text: `[[NEXT FOCUS — private, not spoken by the patient, never read aloud or acknowledged]] ${beat.instruction} [[END NOTE]]`,
          },
        ],
      },
    });
    pushDebug({
      id: crypto.randomUUID(),
      kind: "agenda",
      at: Date.now(),
      beat: beat.id,
      text: beat.instruction,
    });
  }, [pushDebug, send]);

  const sendGuidance = useCallback(
    (text: string) => {
      const note = text.trim();
      if (!note) return;
      // 1. Add the note to the conversation as silent context (persists so it's
      //    available even if we can't act on it this instant).
      send({
        type: "conversation.item.create",
        item: {
          type: "message",
          role: "user",
          content: [
            {
              type: "input_text",
              text: `[[CARE TEAM NOTE — private, not spoken by the patient, never read aloud or acknowledged]] ${note} [[END NOTE]]`,
            },
          ],
        },
      });
      // 2. Queue it and try to act right away.
      pendingGuidanceRef.current.push(note);
      maybeFlushGuidance();
      pushDebug({
        id: crypto.randomUUID(),
        kind: "guidance",
        at: Date.now(),
        text: note,
      });
    },
    [maybeFlushGuidance, pushDebug, send],
  );

  // Poll the KPI endpoint until the background pipeline writes a row newer than
  // the one we saw at call start, then surface it in the debug panel.
  const pollForKpis = useCallback(async () => {
    const debugId = crypto.randomUUID();
    pushDebug({
      id: debugId,
      kind: "kpi",
      at: Date.now(),
      status: "extracting",
    });
    const body = JSON.stringify({
      phone: identityRef.current.phone,
      name: identityRef.current.name,
    });
    for (let i = 0; i < 20; i++) {
      await new Promise((r) => setTimeout(r, 2000));
      try {
        const res = await fetch("/api/kpi/latest", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body,
        });
        if (!res.ok) continue;
        const { latest } = (await res.json()) as {
          latest: { id: string } | null;
        };
        if (latest && latest.id !== baselineKpiIdRef.current) {
          updateDebug(debugId, { status: "done", result: latest });
          return;
        }
      } catch {
        // keep polling
      }
    }
    updateDebug(debugId, { status: "timeout" });
  }, [pushDebug, updateDebug]);

  const handleFunctionCall = useCallback(
    async (event: ServerEvent) => {
      const name = String(event.name ?? "");
      const callId = String(event.call_id ?? "");
      let args: Record<string, unknown> = {};
      try {
        args = JSON.parse(String(event.arguments ?? "{}"));
      } catch {
        args = {};
      }

      setToolActivity(`Calling ${name}…`);
      const debugId = crypto.randomUUID();
      pushDebug({
        id: debugId,
        kind: "tool",
        at: Date.now(),
        name,
        args,
        status: "running",
      });
      let result: unknown;
      let ok = true;
      try {
        result = await runClientTool(name, args, identityRef.current);
      } catch (err) {
        ok = false;
        result = { error: err instanceof Error ? err.message : String(err) };
      }
      setToolActivity(null);
      updateDebug(debugId, { status: ok ? "done" : "error", result });

      // Return the tool result to the model.
      send({
        type: "conversation.item.create",
        item: {
          type: "function_call_output",
          call_id: callId,
          output: JSON.stringify(result),
        },
      });
    },
    [pushDebug, send, updateDebug],
  );

  const handleEvent = useCallback(
    async (event: ServerEvent) => {
      switch (event.type) {
        case "error": {
          const err = (event.error as { message?: string })?.message;
          // Most realtime errors are recoverable; surface but keep the session.
          console.error("[grok-voice] error event:", event.error ?? event);
          if (err) setError(err);
          break;
        }

        case "input_audio_buffer.speech_started": {
          // Barge-in: user started talking, stop assistant playback instantly
          // and reopen the user's turn.
          userSpeakingRef.current = true;
          playerRef.current?.clear();
          speakingRef.current = false;
          assistantTextRef.current = "";
          setStatus("listening");
          break;
        }

        case "input_audio_buffer.speech_stopped": {
          // Patient finished speaking. The server VAD will create a response;
          // that response sees any injected guidance note in context. We also
          // try to flush pending guidance in case nothing else triggers it.
          userSpeakingRef.current = false;
          break;
        }

        case "conversation.item.input_audio_transcription.updated": {
          // Live cumulative transcript for one item. Ignore anything arriving
          // after the assistant has already started replying.
          if (speakingRef.current) break;
          const itemId = String(event.item_id ?? "current");
          userItemsRef.current.set(itemId, String(event.transcript ?? ""));
          upsertStreaming("user", renderUserTurn());
          break;
        }

        case "conversation.item.input_audio_transcription.completed": {
          // The item's final cumulative transcript. Replace (don't append) so
          // corrections to earlier partials don't duplicate. DON'T finalize the
          // bubble yet — the user may continue with a new item after a pause.
          if (speakingRef.current) break;
          const itemId = String(event.item_id ?? "current");
          userItemsRef.current.set(itemId, String(event.transcript ?? ""));
          upsertStreaming("user", renderUserTurn());
          break;
        }

        case "response.output_audio.delta": {
          const delta = event.delta as string | undefined;
          if (delta) {
            // First sign the assistant is replying: the user's turn is over.
            if (!speakingRef.current) {
              speakingRef.current = true;
              finalizeUserTurn();
            }
            setStatus("speaking");
            playerRef.current?.enqueue(base64PCM16ToInt16(delta));
          }
          break;
        }

        case "response.output_audio_transcript.delta": {
          if (!speakingRef.current) {
            speakingRef.current = true;
            finalizeUserTurn();
          }
          assistantTextRef.current += String(event.delta ?? "");
          upsertStreaming("assistant", assistantTextRef.current);
          break;
        }

        case "response.output_audio_transcript.done": {
          finalizeStreaming(
            "assistant",
            String(event.transcript ?? assistantTextRef.current),
          );
          assistantTextRef.current = "";
          break;
        }

        case "response.function_call_arguments.done": {
          // Execute the tool; collect the promise so we can await it before
          // asking the model to continue.
          pendingToolsRef.current.push(handleFunctionCall(event));
          break;
        }

        case "response.done": {
          // The assistant finished; ready for the next user turn.
          speakingRef.current = false;
          // If this turn invoked tools, wait for all of them to finish and for
          // current audio to drain, then ask the model to continue. This avoids
          // overlapping audio between the spoken turn and the tool follow-up.
          const pending = pendingToolsRef.current;
          if (pending.length > 0) {
            pendingToolsRef.current = [];
            await Promise.allSettled(pending);
            await playerRef.current?.waitUntilDone();
            send({ type: "response.create" });
          } else {
            setStatus("listening");
            // Cora's idle and this was a real spoken turn. Count it for agenda
            // pacing, then act on any care-team guidance that arrived while she
            // was speaking. If no guidance fired, advance the assessment agenda
            // so the conversation keeps moving toward the next clinical beat.
            assistantTurnsRef.current += 1;
            const guidanceFired = maybeFlushGuidance();
            if (!guidanceFired) maybeAdvanceAgenda();
          }
          break;
        }

        default:
          break;
      }
    },
    [
      finalizeStreaming,
      finalizeUserTurn,
      handleFunctionCall,
      maybeAdvanceAgenda,
      maybeFlushGuidance,
      renderUserTurn,
      send,
      upsertStreaming,
    ],
  );

  const disconnect = useCallback(() => {
    // If a call was active, persist the transcript to long-term memory before
    // tearing down. Guarded so End-click + ws.onclose don't store twice.
    if (callActiveRef.current) {
      callActiveRef.current = false;
      const turns = transcriptRef.current
        .filter((t) => t.text.trim().length > 0)
        .map((t) => ({ role: t.role, text: t.text }));
      if (turns.some((t) => t.role === "user")) {
        void fetch("/api/remember", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            phone: identityRef.current.phone,
            name: identityRef.current.name,
            turns,
          }),
        }).catch(() => {});
        // Watch for the background KPI extraction and show it in the debug panel.
        void pollForKpis();
      }
    }

    guidanceSourceRef.current?.close();
    guidanceSourceRef.current = null;
    processorRef.current?.disconnect();
    processorRef.current = null;
    sourceRef.current?.disconnect();
    sourceRef.current = null;
    streamRef.current?.getTracks().forEach((t) => {
      t.stop();
    });
    streamRef.current = null;
    playerRef.current?.clear();
    playerRef.current = null;
    if (audioCtxRef.current) {
      audioCtxRef.current.close().catch(() => {});
      audioCtxRef.current = null;
    }
    if (wsRef.current) {
      wsRef.current.onclose = null;
      wsRef.current.close();
      wsRef.current = null;
    }
    assistantTextRef.current = "";
    pendingToolsRef.current = [];
    speakingRef.current = false;
    userSpeakingRef.current = false;
    pendingGuidanceRef.current = [];
    agendaRef.current = [];
    agendaIndexRef.current = 0;
    assistantTurnsRef.current = 0;
    lastProbeTurnRef.current = 0;
    userItemsRef.current = new Map();
    mutedRef.current = false;
    setMuted(false);
    setToolActivity(null);
    setStatus("idle");
  }, [pollForKpis]);

  const connect = useCallback(async () => {
    if (status !== "idle" && status !== "error") return;
    setError(null);
    setTranscript([]);
    setDebugEvents([]);
    setStatus("connecting");

    try {
      // Capture identity for this call (used by server routes + live tools).
      identityRef.current = {
        phone: storage.getPhone(),
        name: storage.getName(),
      };

      // Record the latest existing KPI row id so we can tell when this call's
      // extraction produces a NEW one.
      baselineKpiIdRef.current = null;
      void fetch("/api/kpi/latest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: identityRef.current.phone,
          name: identityRef.current.name,
        }),
      })
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => {
          baselineKpiIdRef.current = d?.latest?.id ?? null;
        })
        .catch(() => {});

      // Open the cross-device caretaker guidance channel. Any note a caretaker
      // sends (from another device) streams in here and is injected silently.
      try {
        const params = new URLSearchParams({
          phone: identityRef.current.phone,
          name: identityRef.current.name,
        });
        const es = new EventSource(`/api/guidance/stream?${params}`);
        es.addEventListener("guidance", (e) => {
          try {
            const note = JSON.parse((e as MessageEvent).data) as {
              text?: string;
            };
            if (note.text) sendGuidance(note.text);
          } catch {
            // ignore malformed event
          }
        });
        guidanceSourceRef.current = es;
      } catch {
        // EventSource unavailable — same-screen caretaker bar still works.
      }

      // 1. Start the call: mint an ephemeral token AND get memory-personalized
      //    instructions, both built server-side (keys never reach the browser).
      //    We send the real signed-up identity so the call uses their DB name.
      const tokenRes = await fetch("/api/realtime-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: identityRef.current.phone,
          name: identityRef.current.name,
          companionName: storage.getCompanionName(),
        }),
      });
      if (!tokenRes.ok) {
        const body = await tokenRes.json().catch(() => ({}));
        throw new Error(body.error ?? "Failed to get realtime token");
      }
      const {
        value: token,
        instructions,
        agenda,
      } = (await tokenRes.json()) as {
        value: string;
        instructions?: string;
        agenda?: AgendaBeat[];
      };
      instructionsRef.current = instructions ?? FALLBACK_INSTRUCTIONS;
      // Load the ordered assessment agenda and reset its pacing counters.
      agendaRef.current = agenda ?? [];
      agendaIndexRef.current = 0;
      assistantTurnsRef.current = 0;
      lastProbeTurnRef.current = 0;

      // 2. Set up audio (single context for capture + playback at 24kHz).
      const audioCtx = new AudioContext({ sampleRate: SAMPLE_RATE });
      await audioCtx.resume();
      audioCtxRef.current = audioCtx;
      playerRef.current = new PCMPlayer(audioCtx, SAMPLE_RATE);

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      streamRef.current = stream;

      const source = audioCtx.createMediaStreamSource(stream);
      sourceRef.current = source;
      const processor = audioCtx.createScriptProcessor(4096, 1, 1);
      processorRef.current = processor;

      processor.onaudioprocess = (e) => {
        const ws = wsRef.current;
        if (!ws || ws.readyState !== WebSocket.OPEN) return;
        // Muted: drop the frame so no audio reaches the realtime API.
        if (mutedRef.current) return;
        const input = e.inputBuffer.getChannelData(0);
        ws.send(
          JSON.stringify({
            type: "input_audio_buffer.append",
            audio: float32ToBase64PCM16(input),
          }),
        );
      };
      source.connect(processor);
      // Output buffer is left silent; connecting to destination keeps the
      // processor firing in Chromium.
      processor.connect(audioCtx.destination);

      // 3. Open the realtime WebSocket. Browsers can't set headers, so the
      // ephemeral token rides in the subprotocol with the required prefix.
      const ws = new WebSocket(REALTIME_URL, [`xai-client-secret.${token}`]);
      wsRef.current = ws;
      callActiveRef.current = true;

      ws.onopen = () => {
        send({
          type: "session.update",
          session: {
            instructions: instructionsRef.current,
            voice: storage.getVoice(),
            turn_detection: {
              type: "server_vad",
              // Give callers (especially older ones) room to pause and think
              // without being cut off mid-sentence.
              silence_duration_ms: 1100,
              prefix_padding_ms: 300,
            },
            audio: {
              input: {
                format: { type: "audio/pcm", rate: SAMPLE_RATE },
                transcription: { model: "grok-transcribe" },
              },
              output: { format: { type: "audio/pcm", rate: SAMPLE_RATE } },
            },
            tools: voiceTools,
          },
        });
        // Have Cora open the call warmly instead of waiting for the patient.
        // A per-response instruction keeps the very first line short — just a
        // hello and ONE question — so the call doesn't start with a barrage.
        send({
          type: "response.create",
          response: {
            instructions:
              "Open the call now. Say only a brief, warm hello and ONE simple question (like 'how are you today?'). Keep it to a sentence or two. Do not ask multiple questions or list topics — just open gently and then wait for their reply.",
          },
        });
        setStatus("listening");
      };

      ws.onmessage = (msg) => {
        let event: ServerEvent;
        try {
          event = JSON.parse(msg.data as string);
        } catch {
          return;
        }
        void handleEvent(event);
      };

      ws.onerror = () => {
        setError("WebSocket connection error.");
        setStatus("error");
      };

      ws.onclose = () => {
        // Only treat as an error if we didn't tear down intentionally.
        if (wsRef.current === ws) {
          disconnect();
        }
      };
    } catch (err) {
      console.error("[grok-voice] connect failed:", err);
      setError(err instanceof Error ? err.message : "Failed to connect");
      disconnect();
      setStatus("error");
    }
  }, [disconnect, handleEvent, send, sendGuidance, status]);

  // Clean up on unmount.
  useEffect(() => () => disconnect(), [disconnect]);

  return {
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
  };
}
