/**
 * In-world read-outs pinned inside rooms on /room/[slot]. Server components:
 * they receive real rows and render plain markup; the scene glues them to
 * a surface with drei's CSS3D layer.
 */

const frame =
  "pointer-events-auto h-full w-full overflow-hidden font-mono leading-snug";

export type LedgerRow = { delta: number; source: string; created_at: string };

/** Cache Storage clipboard: the last byte movements, as a pantry manifest. */
export function LedgerPanel({ bytes, rows }: { bytes: number; rows: LedgerRow[] }) {
  return (
    <div className={`${frame} bg-[#e9e2c9] px-3 py-2 text-[10px] text-[#2b2a24]`}>
      <div className="mb-1 flex items-baseline justify-between border-b border-[#2b2a24]/30 pb-1">
        <span className="font-bold tracking-widest">MANIFEST</span>
        <span>{bytes.toLocaleString("en-US")} B in store</span>
      </div>
      {rows.length === 0 ? (
        <p className="text-[#2b2a24]/60">Nothing logged yet. Push something.</p>
      ) : (
        <ul>
          {rows.map((r, i) => (
            <li key={i} className="flex justify-between gap-2">
              <span className="truncate">{label(r.source)}</span>
              <span className="tabular-nums">
                {r.delta > 0 ? "+" : ""}
                {r.delta} B
              </span>
              <span className="shrink-0 text-[#2b2a24]/50">{r.created_at.slice(5, 10)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function label(source: string): string {
  switch (source) {
    case "github_sync":
      return "push received";
    case "backfill":
      return "salvaged history";
    case "daily_event":
      return "packet outcome";
    case "build":
      return "construction";
    default:
      return source;
  }
}

/** Power Plant gauge: how long the lights have been on, and when the feed last spoke. */
export function UptimePanel({
  days,
  lastSyncAt,
  pushedToday,
}: {
  days: number;
  lastSyncAt: string | null;
  pushedToday: boolean;
}) {
  const ago = lastSyncAt ? minutesAgo(lastSyncAt) : null;
  return (
    <div className={`${frame} bg-[#111] px-3 py-2 text-[10px] text-[#FFD66B] [text-shadow:0_0_5px_rgba(255,214,107,0.5)]`}>
      <div className="mb-1 flex items-baseline justify-between border-b border-[#FFD66B]/30 pb-1">
        <span className="font-bold tracking-widest">GENERATOR</span>
        <span className={pushedToday ? "text-[#7FFF6A]" : "text-[#A14545]"}>
          {pushedToday ? "● FEED LIVE" : "○ FEED IDLE"}
        </span>
      </div>
      <p>
        UPTIME <span className="text-[#E6DFC8]">{days}</span> {days === 1 ? "day" : "days"}
      </p>
      <p>
        LAST SYNC{" "}
        <span className="text-[#E6DFC8]">
          {ago === null ? "never" : ago < 1 ? "just now" : ago < 60 ? `${ago} min ago` : `${Math.floor(ago / 60)} h ago`}
        </span>
      </p>
      <p className="mt-1 text-[#FFD66B]/60">
        {pushedToday ? "Commits keep the lights on." : "No commits today. Running on reserve."}
      </p>
    </div>
  );
}

function minutesAgo(iso: string): number {
  return Math.max(0, Math.floor((Date.now() - Date.parse(iso)) / 60_000));
}
