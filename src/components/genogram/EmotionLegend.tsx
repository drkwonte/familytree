import { EMOTION_COLORS, EMOTION_STROKE_OPACITY, HOUSEHOLD_DASH, STRUCTURE_COLOR } from "@/lib/genogram/constants";

const LEGEND_ITEMS = [
  { kind: "close", label: "친밀", sample: "close" },
  { kind: "distant", label: "소원", sample: "distant" },
  { kind: "fused", label: "융합", sample: "fused" },
  { kind: "conflict", label: "갈등", sample: "conflict" },
  { kind: "cutoff", label: "단절", sample: "cutoff" },
  { kind: "focused", label: "과잉개입", sample: "focused" },
] as const;

function Sample({ kind }: { kind: string }) {
  const color = EMOTION_COLORS[kind] ?? "#fda4af";
  const strokeProps = { stroke: color, strokeOpacity: EMOTION_STROKE_OPACITY };
  if (kind === "conflict") {
    return (
      <svg width="36" height="14" viewBox="0 0 36 14" aria-hidden>
        <path d="M2 7 L8 3 L14 11 L20 3 L26 11 L34 7" fill="none" {...strokeProps} strokeWidth="1.6" />
      </svg>
    );
  }
  if (kind === "close") {
    return (
      <svg width="36" height="14" viewBox="0 0 36 14" aria-hidden>
        <path d="M2 5 A 40 40 0 0 1 34 5" fill="none" {...strokeProps} strokeWidth="2" />
        <path d="M2 9 A 40 40 0 0 1 34 9" fill="none" {...strokeProps} strokeWidth="2" />
      </svg>
    );
  }
  if (kind === "fused") {
    return (
      <svg width="36" height="14" viewBox="0 0 36 14" aria-hidden>
        <path d="M2 3.5 A 40 40 0 0 1 34 3.5" fill="none" {...strokeProps} strokeWidth="1.6" />
        <path d="M2 7 A 40 40 0 0 1 34 7" fill="none" {...strokeProps} strokeWidth="1.6" />
        <path d="M2 10.5 A 40 40 0 0 1 34 10.5" fill="none" {...strokeProps} strokeWidth="1.6" />
      </svg>
    );
  }
  if (kind === "distant") {
    return (
      <svg width="36" height="14" viewBox="0 0 36 14" aria-hidden>
        <path d="M2 7 A 40 40 0 0 1 34 7" fill="none" {...strokeProps} strokeWidth="1.6" strokeDasharray="4 3" />
      </svg>
    );
  }
  if (kind === "cutoff") {
    return (
      <svg width="36" height="14" viewBox="0 0 36 14" aria-hidden>
        <line x1="2" y1="7" x2="16" y2="7" {...strokeProps} strokeWidth="1.6" />
        <line x1="20" y1="7" x2="34" y2="7" {...strokeProps} strokeWidth="1.6" />
        <line x1="16" y1="3" x2="16" y2="11" {...strokeProps} strokeWidth="1.6" />
        <line x1="20" y1="3" x2="20" y2="11" {...strokeProps} strokeWidth="1.6" />
      </svg>
    );
  }
  return (
    <svg width="36" height="14" viewBox="0 0 36 14" aria-hidden>
      <path d="M2 7 A 40 40 0 0 1 30 7" fill="none" {...strokeProps} strokeWidth="1.6" />
      <polygon points="34,7 28,4 28,10" fill={color} fillOpacity={EMOTION_STROKE_OPACITY} />
    </svg>
  );
}

export function EmotionLegend() {
  return (
    <div className="mx-4 mb-3 rounded-xl border bg-card px-4 py-3">
      <p className="mb-2 text-xs font-medium">관계 역동 범례</p>
      <ul className="flex flex-wrap gap-x-5 gap-y-2 text-xs text-muted-foreground">
        {LEGEND_ITEMS.map((item) => (
          <li key={item.kind} className="flex items-center gap-2">
            <Sample kind={item.sample} />
            <span>{item.label}</span>
          </li>
        ))}
        <li className="flex items-center gap-2">
          <svg width="36" height="14" viewBox="0 0 36 14" aria-hidden>
            <rect
              x="1.5"
              y="2"
              width="33"
              height="10"
              fill="none"
              stroke={STRUCTURE_COLOR}
              strokeWidth="1.4"
              strokeDasharray={HOUSEHOLD_DASH}
            />
          </svg>
          <span>동거 가구</span>
        </li>
      </ul>
    </div>
  );
}
