import type { ResourceState } from "@/lib/economy/tick";

type Kind = keyof ResourceState;

const SEGMENTS = 16;
const LABEL: Record<Kind, string> = { cache: "Cache", uptime: "Uptime", payload: "Payload" };
/** 14 px glyphs drawn in currentColor: a crate, a bolt, a rack. */
const ICON: Record<Kind, string> = {
  cache: "M3 4h8v8H3zM3 7h8M6 4V2h2v2",
  uptime: "M8 1 3 8h4l-1 5 5-7H7z",
  payload: "M2 2h10v10H2zM2 7h10M7 2v10",
};

type Props = {
  kind: Kind;
  value: number;
  cap: number;
  /** Net change per hour from ratesPerHour; omitted when there is no honest number to show. */
  ratePerHour?: number;
};

/** One resource as a 16-segment meter: violet when fine, red under 20%, outlined red at zero. */
export function ResourceGauge({ kind, value, cap, ratePerHour }: Props) {
  const label = LABEL[kind];
  const unit = kind === "uptime" ? "%" : "";
  const zero = value <= 0;
  const low = cap > 0 && value < cap * 0.2;
  const full = cap > 0 && value >= cap;
  const lit = cap > 0 ? Math.min(SEGMENTS, Math.ceil((Math.max(0, value) / cap) * SEGMENTS)) : 0;
  const rate =
    ratePerHour === undefined ? null : `${ratePerHour > 0 ? "+" : ratePerHour < 0 ? "−" : ""}${Math.abs(ratePerHour)}${unit}/h`;
  // The bar says FULL; screen readers still hear a drain on a full store.
  const trend =
    full ? (ratePerHour !== undefined && ratePerHour < 0 ? `full, ${kind === "uptime" ? "draining" : "falling"} ${-ratePerHour} per hour` : "full")
    : ratePerHour === undefined ? null
    : ratePerHour > 0 ? `${kind === "uptime" ? "charging" : "rising"} ${ratePerHour} per hour`
    : ratePerHour < 0 ? `${kind === "uptime" ? "draining" : "falling"} ${-ratePerHour} per hour`
    : "steady";
  const tone = low ? "text-hud-red-text" : "text-hud-violet";

  return (
    <div
      role="meter"
      aria-valuenow={value}
      aria-valuemin={0}
      aria-valuemax={cap}
      aria-label={`${label} ${value} of ${cap}${trend ? `, ${trend}` : ""}`}
      className="w-[168px] shrink-0 font-mono"
    >
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.22em]">
        <svg aria-hidden viewBox="0 0 14 14" className={`h-3.5 w-3.5 fill-none stroke-current ${tone}`} strokeWidth={1.4}>
          <path d={ICON[kind]} />
        </svg>
        <span className="text-hud-bone/70">{label}</span>
        <span className={`ml-auto text-xs tracking-normal tabular-nums ${low ? "text-hud-red-text" : "text-hud-bone"}`}>
          {kind === "uptime" ? `${value}%` : `${value}/${cap}`}
        </span>
      </div>
      <div className="mt-1 flex items-center gap-2">
        <div aria-hidden className="flex gap-0.5" data-testid="segments">
          {Array.from({ length: SEGMENTS }, (_, i) => (
            <span
              key={i}
              data-lit={i < lit || undefined}
              className={`h-2 w-1.5 ${
                zero ? "border border-hud-red" : i < lit ? (low ? "bg-hud-red-text" : "bg-hud-violet") : "bg-hud-plum"
              }`}
            />
          ))}
        </div>
        {(full || rate) && (
          <span className="ml-auto text-[10px] uppercase tabular-nums text-hud-bone/60">{full ? "FULL" : rate}</span>
        )}
      </div>
    </div>
  );
}
