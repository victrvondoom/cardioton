/**
 * CROSS-5 synchronized multiscale timeline (SVG).
 *
 * Three wall-clock bands from the CardioChronos engine: hourly wearable HR,
 * daily aggregates and monthly clinical history. The replay marker shows the
 * point-in-time reconstruction boundary (everything to its right is excluded
 * from a retrospective replay — no future-data leakage).
 */
import type { ChronosTimeline } from "./core__src_cross5__api";

const W = 1100;
const H = 176;

export function Cross5Timeline({
  timeline,
  replayAsOf,
}: {
  timeline: ChronosTimeline | null;
  replayAsOf: string | null;
}) {
  if (!timeline) {
    return (
      <div className="grid h-[176px] place-items-center text-[12px] text-ink-muted">
        Load a patient timeline to display the multiscale bands.
      </div>
    );
  }
  const hourly = timeline.bands.hourly_wearable;
  const daily = timeline.bands.daily_aggregates;
  const monthly = timeline.bands.monthly_history;
  const hours = Math.max(hourly.length, 1);

  const pad = 44;
  const inner = W - pad - 20;
  const xOfHour = (i: number) => pad + (i / Math.max(hours - 1, 1)) * inner;
  const hrValues = hourly.map((h) => h.heart_rate_bpm);
  const hrMin = Math.min(...hrValues, 45);
  const hrMax = Math.max(...hrValues, 80);
  const yHr = (v: number) => 40 - ((v - hrMin) / Math.max(hrMax - hrMin, 1)) * 26;

  const band2Top = 62;
  const band3Top = 116;
  const xOfDay = (i: number) => pad + ((i + 0.5) / Math.max(daily.length, 1)) * inner;
  const xOfMonth = (i: number) => pad + ((i + 0.5) / Math.max(monthly.length, 1)) * inner;

  const replayX = replayAsOf
    ? (() => {
        const asOf = new Date(replayAsOf).getTime();
        const start = new Date(hourly[0]?.timestamp ?? replayAsOf).getTime();
        const hourMs = 3600_000;
        return pad + Math.max(0, Math.min(inner, ((asOf - start) / hourMs / Math.max(hours - 1, 1)) * inner));
      })()
    : null;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Multiscale timeline: hourly heart rate, daily aggregates, monthly clinical history">
      <text x="8" y="18" className="fill-ink-faint" fontSize="9">HOURLY · wearable HR (bpm)</text>
      <text x="8" y={band2Top + 12} className="fill-ink-faint" fontSize="9">DAILY · mean HR / sleep</text>
      <text x="8" y={band3Top + 12} className="fill-ink-faint" fontSize="9">MONTHLY · LDL (mg/dL)</text>

      {/* hourly HR polyline */}
      <polyline
        fill="none"
        stroke="#f2a900"
        strokeWidth="1.6"
        points={hourly.map((h, i) => `${xOfHour(i)},${yHr(h.heart_rate_bpm)}`).join(" ")}
      />
      {/* daily bars */}
      {daily.map((d, i) => (
        <rect key={d.date} x={xOfDay(i) - 7} y={band2Top + 16} width="14" height={Math.min(30, 6 + d.sleep_samples)} fill="#5b8db8" opacity="0.75" rx="2" />
      ))}
      {/* monthly LDL */}
      <polyline
        fill="none"
        stroke="#c85c8e"
        strokeWidth="1.6"
        points={monthly.map((m, i) => `${xOfMonth(i)},${band3Top + 34 - ((m.ldl_mg_dl - 100) / 60) * 26}`).join(" ")}
      />
      {monthly.map((m, i) => (
        <circle key={m.month} cx={xOfMonth(i)} cy={band3Top + 34 - ((m.ldl_mg_dl - 100) / 60) * 26} r="2.4" className="fill-accent-red" />
      ))}

      {replayX !== null && (
        <g>
          <line x1={replayX} y1="6" x2={replayX} y2={H - 8} stroke="#3b82f6" strokeWidth="1.4" strokeDasharray="4 3" />
          <text x={replayX + 4} y={H - 2} fontSize="9" className="fill-accent-cyan">replay as-of · future excluded</text>
        </g>
      )}
      <line x1={pad} y1={H - 8} x2={W - 20} y2={H - 8} stroke="currentColor" strokeOpacity="0.2" />
      <text x={pad} y={H - 1} fontSize="8.5" className="fill-ink-faint">
        {hourly[0]?.timestamp.slice(0, 16).replace("T", " ")} UTC
      </text>
      <text x={W - 20} y={H - 1} fontSize="8.5" textAnchor="end" className="fill-ink-faint">
        {hourly[hourly.length - 1]?.timestamp.slice(0, 16).replace("T", " ")} UTC
      </text>
    </svg>
  );
}
