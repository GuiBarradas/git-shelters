import { after } from "next/server";

import { SessionBeacon } from "@/components/analytics/SessionBeacon";
import { AuthBar } from "@/components/auth/AuthBar";
import { AwaySummary } from "@/components/hud/AwaySummary";
import { BadgeToast } from "@/components/hud/BadgeToast";
import { Landing } from "@/components/landing/Landing";
import { BunkerSceneClient } from "@/components/scene/BunkerSceneClient";
import { trackSessionStart } from "@/lib/analytics/track";
import { awardBadges } from "@/lib/badges/award";
import { awayReport } from "@/lib/economy/away";
import { settleResources, workforce } from "@/lib/economy/resources";
import { cacheCap, payloadCap } from "@/lib/economy/tick";
import { fetchDailyEvent } from "@/lib/events/daily";
import { loadCrew } from "@/lib/forks/load";
import { describeCrew, eventEcho, settleMood } from "@/lib/forks/mood";
import { isRoomKind, isSlot, type Room } from "@/lib/rooms/catalog";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return <Landing />;

  const admin = createAdminClient();

  // Analytics after the response: never delays the bunker, never throws.
  after(() => trackSessionStart(admin, { id: user.id, created_at: user.created_at }));

  // Supabase populates user_metadata from the OAuth provider profile.
  // For GitHub, `user_name` is the @handle (e.g. "GuiBarradas").
  const githubLogin =
    typeof user?.user_metadata?.user_name === "string" ? user.user_metadata.user_name : null;

  // Main Branch tint is driven by persisted state, not a live GitHub fetch.
  // Anyone who pushed today will have at least one byte_transactions row
  // tagged source = 'github_sync' with created_at on today's UTC date.
  const todayUtc = new Date().toISOString().slice(0, 10);
  const [activeToday, rooms, dailyEvent, crew, commitsCounted] = await Promise.all([
    checkActivityToday(supabase, user.id, todayUtc),
    fetchRooms(supabase, user.id),
    fetchDailyEvent(supabase, user.id, todayUtc),
    loadCrew(supabase, admin, user.id),
    countCommits(supabase, user.id),
  ]);

  // Badges are derived from the state above; a bonus lands in the ledger
  // before the balance is read so the HUD shows it on the same visit.
  const { fresh: freshBadges } = await awardBadges(supabase, admin, user.id, {
    createdAt: user.created_at,
    commitsCounted,
    rooms: rooms.length,
    forks: crew.forks.length,
    traits: crew.forks.map((f) => f.trait),
    region: "the_outage",
    now: new Date(),
  });
  const bytes = await fetchBytes(supabase, user.id);

  // Catch-up: what the crew produced and ate since the last visit.
  const resources = await settleResources(supabase, admin, user.id, crew.forks, rooms);

  // Today's packet and an empty pantry both land on the crew's mood.
  const echo = eventEcho(dailyEvent);
  const moodCtx = { echo, starving: resources.cache === 0 };
  const forks = crew.forks.map((f) => ({ ...f, mood: settleMood(f.mood, moodCtx) }));
  const crewMood = settleMood(crew.mood, moodCtx);

  // "While you were away": what the ledger and the simulation did since the last tick.
  const work = workforce(crew.forks, rooms);
  const report = awayReport({
    hours: resources.hours,
    before: resources.before,
    after: resources,
    bytesIn: await bytesSince(supabase, user.id, resources.since),
    cooks: work.cooks,
    engineers: work.engineers,
    tinkerers: work.tinkerers,
    crewMood,
  });

  return (
    <main className="relative w-full h-dvh">
      <SessionBeacon />
      <BunkerSceneClient
        rooms={rooms}
        forks={forks}
        bytes={bytes}
        activeToday={activeToday}
        eventPending={echo === "pending"}
        echo={echo}
        powered={resources.uptime > 0}
      />
      <div className="pointer-events-none absolute top-4 right-4 z-10">
        <AuthBar githubLogin={githubLogin} bytes={bytes} />
      </div>
      {report && <AwaySummary report={report} />}
      <BadgeToast badges={freshBadges} />
      <div className="pointer-events-none absolute top-16 left-6 z-10 space-y-1 font-mono text-xs">
        <p className="text-[#E6DFC8]/70">
          <span className={resources.cache === 0 ? "text-[#A14545]" : ""}>
            CACHE {resources.cache}/{cacheCap(rooms.filter((r) => r.kind === "cache_storage").length)}
          </span>
          {" · "}
          <span className={resources.uptime === 0 ? "text-[#A14545]" : ""}>UPTIME {resources.uptime}%</span>
          {work.workshops > 0 && (
            <>
              {" · "}
              PAYLOAD {resources.payload}/{payloadCap(work.workshops)}
            </>
          )}
        </p>
        {resources.uptime === 0 && <p className="text-[#A14545]">&gt; blackout. Put an engineer on the Power Plant.</p>}
        {resources.cache === 0 && <p className="text-[#A14545]">&gt; the pantry is empty. Nobody is cooking.</p>}
        {dailyEvent && !dailyEvent.resolved && (
          <p className="text-[#7FFF6A]/80">&gt; incoming packet on the Main Branch terminal</p>
        )}
        <p className="text-[#E6DFC8]/50">&gt; {describeCrew(crewMood, crew.lastPushAt, new Date(), echo)}</p>
      </div>
    </main>
  );
}

/** Pushes the sync has credited, all time: the badge counter for "commits counted". */
async function countCommits(supabase: Awaited<ReturnType<typeof createClient>>, userId: string): Promise<number> {
  const { data } = await supabase
    .from("byte_transactions")
    .select("delta")
    .eq("user_id", userId)
    .in("source", ["github_sync", "backfill"]);
  return (data ?? []).reduce((sum, r) => sum + r.delta, 0);
}

/** Positive ledger movements since `sinceIso`: what came in while the player was away. */
async function bytesSince(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  sinceIso: string,
): Promise<number> {
  const { data } = await supabase
    .from("byte_transactions")
    .select("delta")
    .eq("user_id", userId)
    .gt("delta", 0)
    .gt("created_at", sinceIso);
  return (data ?? []).reduce((sum, r) => sum + r.delta, 0);
}

/**
 * The player's built rooms (RLS `rooms_select_own`). Rows are narrowed
 * through the catalog guards so a kind added in SQL before the catalog
 * is simply not rendered instead of crashing the scene.
 */
async function fetchRooms(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
): Promise<Room[]> {
  const { data } = await supabase.from("rooms").select("slot, kind").eq("user_id", userId);
  return (data ?? []).flatMap(({ slot, kind }) => (isSlot(slot) && isRoomKind(kind) ? [{ slot, kind }] : []));
}

/**
 * Materialised balance from `users.bytes` (kept in sync by credit_bytes_tx).
 * RLS `users_select_own` scopes this to the caller. Returns null if the
 * row is somehow missing so the HUD can degrade instead of showing "0".
 */
async function fetchBytes(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
): Promise<number | null> {
  const { data } = await supabase.from("users").select("bytes").eq("id", userId).maybeSingle();
  return data?.bytes ?? null;
}

/**
 * Checks if the user has at least one push credited for the given UTC
 * date. Cheap query — one indexed lookup, head-only. The upper bound is
 * the next day's midnight UTC (exclusive).
 */
async function checkActivityToday(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  todayUtc: string,
): Promise<boolean> {
  const tomorrowUtc = nextUtcDate(todayUtc);
  const { count } = await supabase
    .from("byte_transactions")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .in("source", ["github_sync", "backfill"])
    .gte("created_at", `${todayUtc}T00:00:00Z`)
    .lt("created_at", `${tomorrowUtc}T00:00:00Z`);
  return (count ?? 0) > 0;
}

function nextUtcDate(yyyyMmDd: string): string {
  const ms = Date.parse(`${yyyyMmDd}T00:00:00Z`) + 86_400_000;
  return new Date(ms).toISOString().slice(0, 10);
}
