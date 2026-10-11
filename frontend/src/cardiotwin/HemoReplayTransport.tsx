import { Pause, Play, SkipBack, SkipForward } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

/** Replay always requests an authoritative reconstruction; it never interpolates states. */
export default function HemoReplayTransport({ dates, asOf, busy, failed, onReplay }: {
  dates: string[]; asOf: string; busy: boolean; failed: boolean; onReplay: (at: string) => void;
}) {
  const moments = useMemo(() => [...new Set(dates.filter(date => Number.isFinite(Date.parse(date))))].sort((a, b) => Date.parse(a) - Date.parse(b)), [dates]);
  const [playing, setPlaying] = useState(false);
  const boundary = Date.parse(asOf);
  const validBoundary = Number.isFinite(boundary);
  const latestIndex = validBoundary ? moments.reduce((latest, moment, momentIndex) => Date.parse(moment) <= boundary ? momentIndex : latest, -1) : -1;
  const previousIndex = validBoundary ? moments.reduce((previous, moment, momentIndex) => Date.parse(moment) < boundary ? momentIndex : previous, -1) : -1;
  const nextIndex = validBoundary ? moments.findIndex(moment => Date.parse(moment) > boundary) : -1;
  const index = Math.max(0, latestIndex);
  const available = moments.length > 1;
  useEffect(() => {
    if (failed || !validBoundary) setPlaying(false);
    if (!playing || busy || failed || !available || !validBoundary) return;
    if (nextIndex < 0) { setPlaying(false); return; }
    const timer = window.setTimeout(() => {
      if (document.visibilityState === "hidden") { setPlaying(false); return; }
      onReplay(moments[nextIndex]);
    }, 2600);
    return () => window.clearTimeout(timer);
  }, [playing, busy, failed, available, validBoundary, nextIndex, moments, onReplay]);
  const select = (next: number) => {
    setPlaying(false);
    if (busy || !validBoundary) return;
    const date = moments[next];
    if (date) onReplay(date);
  };
  const toggle = () => {
    if (playing) { setPlaying(false); return; }
    if (busy || !validBoundary) return;
    if (nextIndex < 0) onReplay(moments[0]);
    setPlaying(true);
  };

  if (!available) return null;
  return <div className="mt-4 rounded-xl border border-surface-border bg-surface-bg p-3" aria-label="Evidence replay transport">
    <div className="flex flex-wrap items-center gap-2">
      <button type="button" onClick={() => select(previousIndex)} disabled={busy || previousIndex < 0} aria-label="Previous evidence time" className="rounded-lg border border-surface-border p-2 text-ink-body disabled:opacity-40"><SkipBack size={14} aria-hidden /></button>
      <button type="button" onClick={toggle} disabled={!playing && (busy || !validBoundary)} aria-label={playing ? "Pause evidence replay" : "Play evidence replay"} aria-pressed={playing} className="inline-flex items-center gap-1.5 rounded-lg border border-accent-brand/50 bg-accent-brand/10 px-3 py-2 text-xs text-ink-primary disabled:opacity-40">{playing ? <Pause size={13} aria-hidden /> : <Play size={13} aria-hidden />}{playing ? "Pause replay" : "Play timeline"}</button>
      <button type="button" onClick={() => select(nextIndex)} disabled={busy || nextIndex < 0} aria-label="Next evidence time" className="rounded-lg border border-surface-border p-2 text-ink-body disabled:opacity-40"><SkipForward size={14} aria-hidden /></button>
      <label className="min-w-[130px] flex-1 text-[10px] text-ink-muted">Scrub evidence time<input type="range" aria-label="Scrub evidence time" aria-valuetext={validBoundary ? `${asOf.slice(0, 10)}; ${latestIndex < 0 ? "before first checkpoint" : `latest checkpoint ${moments[latestIndex].slice(0, 10)}`}` : "Replay time unavailable"} min={0} max={moments.length - 1} step={1} value={index} disabled={busy || !validBoundary} onChange={event => select(Number(event.target.value))} className="mt-1 block w-full accent-accent-brand" /></label>
      <output className="text-[11px] font-medium tabular-nums text-ink-body" aria-live="polite">{busy ? "Reconstructing…" : !validBoundary ? "Replay time unavailable" : `${asOf.slice(0, 10)} · ${latestIndex + 1} / ${moments.length} checkpoints reached`}</output>
    </div>
    <p className="mt-2 text-[10px] leading-relaxed text-ink-muted">Each frame loads the evidence known at that time. Playback uses dated source records; heart animation remains illustrative.</p>
  </div>;
}
