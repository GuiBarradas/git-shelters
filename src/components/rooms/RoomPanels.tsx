/**
 * In-world read-outs pinned inside rooms on /room/[slot]. Server components:
 * they receive real rows and render plain markup; the scene glues them to
 * a surface with drei's CSS3D layer.
 */

const frame =
  "pointer-events-auto h-full w-full overflow-hidden font-mono leading-snug";

export type LedgerRow = { delta: number; source: string; created_at: string };

/** Cache Storage clipboard: the pantry count, who cooks, and the last byte movements. */
export function LedgerPanel({
  bytes,
  rows,
  cache,
  cacheCap,
  cooks,
}: {
  bytes: number;
  rows: LedgerRow[];
  cache: number;
  cacheCap: number;
  cooks: string[];
}) {
  return (
    <div className={`${frame} bg-[#e9e2c9] px-3 py-2 text-[10px] text-[#2b2a24]`}>
      <div className="mb-1 flex items-baseline justify-between border-b border-[#2b2a24]/30 pb-1">
        <span className="font-bold tracking-widest">PANTRY</span>
        <span className={cache === 0 ? "font-bold text-[#A14545]" : ""}>
          {cache}/{cacheCap} meals
        </span>
      </div>
      <p className="mb-1 text-[#2b2a24]/70">
        {cooks.length === 0 ? "No cook on shift. Shelves only empty." : `Cook: ${cooks.join(", ")}`}
      </p>
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
  uptime,
  engineers,
}: {
  days: number;
  lastSyncAt: string | null;
  pushedToday: boolean;
  uptime: number;
  engineers: string[];
}) {
  const ago = lastSyncAt ? minutesAgo(lastSyncAt) : null;
  return (
    <div className={`${frame} bg-[#111] px-3 py-2 text-[10px] text-[#E67E22] [text-shadow:0_0_5px_rgba(230, 126, 34,0.5)]`}>
      <div className="mb-1 flex items-baseline justify-between border-b border-[#E67E22]/30 pb-1">
        <span className="font-bold tracking-widest">GENERATOR</span>
        <span className={pushedToday ? "text-[#BD93F9]" : "text-[#A14545]"}>
          {pushedToday ? "● FEED LIVE" : "○ FEED IDLE"}
        </span>
      </div>
      <p>
        CHARGE <span className={uptime === 0 ? "text-[#A14545]" : "text-[#E6DFC8]"}>{uptime}%</span>
        <span className="text-[#E67E22]/60">
          {" "}
          · {engineers.length === 0 ? "nobody on the crank" : `engineer: ${engineers.join(", ")}`}
        </span>
      </p>
      <p>
        UPTIME <span className="text-[#E6DFC8]">{days}</span> {days === 1 ? "day" : "days"}
      </p>
      <p>
        LAST SYNC{" "}
        <span className="text-[#E6DFC8]">
          {ago === null ? "never" : ago < 1 ? "just now" : ago < 60 ? `${ago} min ago` : `${Math.floor(ago / 60)} h ago`}
        </span>
      </p>
      <p className="mt-1 text-[#E67E22]/60">
        {pushedToday ? "Commits keep the lights on." : "No commits today. Running on reserve."}
      </p>
    </div>
  );
}

/** Dorm pinboard: beds against bodies, and who is sleeping it off. */
export function BunkPanel({ beds, crew, sleepers }: { beds: number; crew: number; sleepers: string[] }) {
  const free = Math.max(0, beds - crew);
  return (
    <div className={`${frame} bg-[#3b3325] px-3 py-2 text-[10px] text-[#E6DFC8] [text-shadow:none]`}>
      <div className="mb-1 flex items-baseline justify-between border-b border-[#E6DFC8]/30 pb-1">
        <span className="font-bold tracking-widest">BUNK ROSTER</span>
        <span className={free === 0 ? "text-[#A14545]" : "text-[#BD93F9]"}>
          {free === 0 ? "○ FULL" : `● ${free} FREE`}
        </span>
      </div>
      <p>
        BEDS <span className="text-[#E67E22]">{crew}</span>/{beds}
      </p>
      <p className="text-[#E6DFC8]/70">
        {sleepers.length === 0 ? "nobody sleeping. The blankets are cold." : `sleeping: ${sleepers.join(", ")}`}
      </p>
      <p className="mt-1 text-[#E6DFC8]/60">
        {free === 0 ? "Full house. Another Dorm means two more beds." : "Room at the door for a new Fork."}
      </p>
    </div>
  );
}

/** Workshop chalkboard: rounds on the rack, who packs them, and what is missing. */
export function BenchPanel({
  payload,
  cap,
  tinkerers,
  powered,
}: {
  payload: number;
  cap: number;
  tinkerers: string[];
  powered: boolean;
}) {
  return (
    <div className={`${frame} bg-[#1a1d1a] px-3 py-2 text-[10px] text-[#E6DFC8] [text-shadow:0_0_2px_rgba(230,223,200,0.4)]`}>
      <div className="mb-1 flex items-baseline justify-between border-b border-[#E6DFC8]/30 pb-1">
        <span className="font-bold tracking-widest">PAYLOAD RACK</span>
        <span className={payload >= cap ? "text-[#E67E22]" : "text-[#BD93F9]"}>{payload >= cap ? "○ FULL" : "● PACKING"}</span>
      </div>
      <p>
        ROUNDS <span className="text-[#E67E22]">{payload}</span>/{cap}
      </p>
      <p className="text-[#E6DFC8]/70">
        {tinkerers.length === 0 ? "nobody at the bench." : `tinkerer: ${tinkerers.join(", ")}`}
      </p>
      <p className="mt-1 text-[#E6DFC8]/60">
        {!powered
          ? "No light. The bench waits."
          : "No blueprints yet. Packing basic rounds for when the crawlers come."}
      </p>
    </div>
  );
}

function minutesAgo(iso: string): number {
  return Math.max(0, Math.floor((Date.now() - Date.parse(iso)) / 60_000));
}
