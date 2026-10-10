import { useId } from "react";
import { ArrowUpRight, Layers3 } from "lucide-react";
import { HEMO_AXES, type HemoAxisKey, type HemoSnapshot } from "./hemoTypes";
import "./hemo-scene.css";

/** Spatial positions are schematic, never a physiological measurement or a risk scale. */
export default function HemoStateScene({ snapshot, onSelect }: { snapshot: HemoSnapshot; onSelect: (axis: HemoAxisKey) => void }) {
  const id = useId().replace(/:/g, "");
  const titleId = `${id}-title`;
  const gradientId = `${id}-heart`;
  return <figure className="hemo-scene" aria-labelledby={titleId}>
    <figcaption className="hemo-scene__caption">
      <div><span className="hemo-scene__eyebrow"><Layers3 size={13} aria-hidden /> Spatial state reconstruction</span><p id={titleId}>Eight evidence-linked dimensions. One reconstructed state.</p></div>
      <span className="hemo-scene__tag">SCHEMATIC RESEARCH VIEW</span>
    </figcaption>
    <div className="hemo-scene__space">
      <div className="hemo-scene__core" aria-hidden="true">
        <div className="hemo-scene__floor"><span /><span /><span /></div>
        <div className="hemo-scene__heart">
          <div className="hemo-scene__heart-depth hemo-scene__heart-depth--back" />
          <div className="hemo-scene__heart-depth hemo-scene__heart-depth--mid" />
          <svg className="hemo-scene__heart-front" viewBox="0 0 240 260" fill="none">
            <defs><linearGradient id={gradientId} x1="35" y1="25" x2="195" y2="245" gradientUnits="userSpaceOnUse"><stop stopColor="#ffb7b4" /><stop offset=".38" stopColor="#ee7b8c" /><stop offset="1" stopColor="#9b385f" /></linearGradient></defs>
            <path d="M110 60C87 28 47 39 36 70C22 108 43 147 72 177L121 229C138 213 178 172 193 140C210 103 200 67 174 57C155 49 138 55 125 72L110 60Z" fill={`url(#${gradientId})`} stroke="#ffd6d1" strokeWidth="1.5" />
            <path d="M110 63C106 99 115 131 124 159C134 185 128 207 121 229M127 72C146 83 157 106 160 128" stroke="#74284f" strokeWidth="10" strokeLinecap="round" opacity=".3" />
            <path d="M116 64V38C116 21 132 14 145 23L162 36M98 64L92 32M151 62L170 43" stroke="#ffb8b5" strokeWidth="17" strokeLinecap="round" />
            <path d="M96 91L77 115L71 146M96 91L102 125L120 159L116 183M102 125L84 135M122 89L147 109L156 143" stroke="#ffe6d1" strokeWidth="2.5" strokeLinecap="round" opacity=".9" />
            <path d="M66 75C48 90 50 111 63 130M139 76C157 74 175 89 178 109" stroke="#fff2e2" strokeWidth="4" strokeLinecap="round" opacity=".45" />
          </svg>
          <span className="hemo-scene__orbit hemo-scene__orbit--one" /><span className="hemo-scene__orbit hemo-scene__orbit--two" />
        </div>
        <div className="hemo-scene__core-label"><span>CARDIO / HEMO</span><strong>Evidence → state</strong><small>Confidence · {snapshot.confidence}</small></div>
      </div>
      <ul className="hemo-scene__axes" aria-label="Spatial cardiovascular state">
        {HEMO_AXES.map(([key, label], index) => {
          const axis = snapshot[key];
          return <li key={key} className={`hemo-scene__axis hemo-scene__axis--${index % 2 === 0 ? "left" : "right"}`}>
            <button type="button" className={`hemo-scene__node hemo-scene__node--${axis.level.toLowerCase()}`} onClick={() => onSelect(key)} aria-label={`Inspect ${label} state: ${axis.level}. ${axis.classification}. ${axis.confidence} confidence.`}>
              <span className="hemo-scene__node-label">{label}<ArrowUpRight size={12} aria-hidden /></span>
              <strong>{axis.level}</strong>
              <span className="hemo-scene__node-meta">{axis.classification} · {axis.confidence}</span>
            </button>
          </li>;
        })}
      </ul>
    </div>
    <p className="hemo-scene__note">Select any dimension to open its evidence. Spatial position is schematic; UNKNOWN means evidence is missing, stale or conflicting.</p>
  </figure>;
}
