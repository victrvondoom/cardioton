/**
 * CardioCity — SVG map of the synthetic demonstration city graph with
 * facility markers and Dijkstra access analysis from a selected node.
 *
 * Clearly labelled: synthetic network; travel times are graph estimates, not
 * emergency dispatch guidance.
 */
import type { CityEdge, CityFacility, CityNode } from "./core__src_cross5__api";

const CATEGORY_COLOR: Record<string, string> = {
  hospital: "#c8102e",
  clinic: "#f2a900",
  pharmacy: "#3b82f6",
};

export function CityGraphView({
  nodes,
  edges,
  facilities,
  selectedNode,
  onSelect,
  accessFromSelected,
}: {
  nodes: CityNode[];
  edges: CityEdge[];
  facilities: CityFacility[];
  selectedNode: string | null;
  onSelect: (node: string) => void;
  accessFromSelected: { facility: CityFacility; travel_minutes: number | null }[] | null;
}) {
  const xs = nodes.map((n) => n.x);
  const ys = nodes.map((n) => n.y);
  const minX = Math.min(...xs) - 600;
  const maxX = Math.max(...xs) + 600;
  const minY = Math.min(...ys) - 600;
  const maxY = Math.max(...ys) + 600;
  const W = 640;
  const H = 460;
  const sx = (x: number) => ((x - minX) / (maxX - minX)) * (W - 60) + 30;
  const sy = (y: number) => H - (((y - minY) / (maxY - minY)) * (H - 60) + 30);
  const facilityByNode: Record<string, CityFacility[]> = {};
  for (const f of facilities) {
    (facilityByNode[f.node] ??= []).push(f);
  }
  const nearestId = accessFromSelected?.[0]?.facility.id ?? null;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-full w-full" role="img" aria-label="Synthetic demonstration city: roads, nodes, healthcare facilities">
      {edges.map((e) => {
        const a = nodes.find((n) => n.id === e.a)!;
        const b = nodes.find((n) => n.id === e.b)!;
        return (
          <line key={`${e.a}-${e.b}`} x1={sx(a.x)} y1={sy(a.y)} x2={sx(b.x)} y2={sy(b.y)} stroke="currentColor" strokeOpacity="0.25" strokeWidth="2.5" />
        );
      })}
      {nodes.map((n) => (
        <g key={n.id} onClick={() => onSelect(n.id)} className="cursor-pointer">
          <circle
            cx={sx(n.x)}
            cy={sy(n.y)}
            r={n.id === selectedNode ? 9 : 6}
            fill={n.id === selectedNode ? "#3b82f6" : "#5b8db8"}
            stroke="white"
            strokeWidth="1.2"
          />
          <text x={sx(n.x) + 11} y={sy(n.y) + 3} fontSize="9" className="fill-ink-muted">
            {n.id}
            {facilityByNode[n.id]?.length ? " ★" : ""}
          </text>
        </g>
      ))}
      {facilities.map((f) => {
        const node = nodes.find((n) => n.id === f.node)!;
        const highlight = f.id === nearestId;
        return (
          <g key={f.id}>
            <rect
              x={sx(node.x) - 5}
              y={sy(node.y) - 22 - (facilityByNode[f.node]?.indexOf(f) ?? 0) * 0}
              width="10"
              height="10"
              rx="2"
              fill={CATEGORY_COLOR[f.category] ?? "#8aa1b5"}
              opacity={highlight ? 1 : 0.8}
              stroke={highlight ? "#111" : "none"}
            />
          </g>
        );
      })}
      <g>
        {Object.entries(CATEGORY_COLOR).map(([cat, color], i) => (
          <g key={cat} transform={`translate(${W - 150}, ${20 + i * 16})`}>
            <rect width="9" height="9" rx="2" fill={color} />
            <text x="14" y="8" fontSize="9.5" className="fill-ink-muted">{cat}</text>
          </g>
        ))}
      </g>
    </svg>
  );
}
