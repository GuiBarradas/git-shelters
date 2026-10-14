import { loadUserVisuals } from "@/lib/visuals/server";
import { after } from "next/server";

import { SessionBeacon } from "@/components/analytics/SessionBeacon";
import { AwaySummary } from "@/components/hud/AwaySummary";
import { BadgeToast } from "@/components/hud/BadgeToast";
import { CrewLog, crewTip } from "@/components/hud/CrewLog";
import { PacketCard } from "@/components/hud/PacketCard";
import { resourceAlert, staffingTarget } from "@/components/hud/resourceAlert";
import { TopBar } from "@/components/hud/TopBar";
import { Intro } from "@/components/intro/Intro";
import { Landing } from "@/components/landing/Landing";
import { BunkerSceneClient } from "@/components/scene/BunkerSceneClient";
import { trackSessionStart } from "@/lib/analytics/track";
import { awardBadges } from "@/lib/badges/award";
import { awayReport } from "@/lib/economy/away";
import { settleResources, workforce } from "@/lib/economy/resources";
import { fetchDailyEvent } from "@/lib/events/daily";
import { loadCrew } from "@/lib/forks/load";
import { eventEcho, settleMood } from "@/lib/forks/mood";
import { loadUnread } from "@/lib/notices";
import { isRoomKind, isSlot, ROOM_CATALOG, type Room } from "@/lib/rooms/catalog";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

type HomeProps = { searchParams: Promise<{ intro?: string; build?: string }> };

/**
 * `/?intro=1` replays the intro and credits for anyone signed in.
 * `/?build=<kind>` comes from a room's AlertBanner: it opens the build menu
 * on a free slot, only when the alert still asks for that room and it is affordable.
 */
export default async function Home({ searchParams }: HomeProps) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return <Landing />;
  const params = await searchParams;
  const replayIntro = params.intro === "1";

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
  const observedAt = new Date().toISOString();
  const todayUtc = observedAt.slice(0, 10);
  const [activeToday, rooms, dailyEvent, crew, commitsCounted, packets, firstEvent, lastSyncedAt] = await Promise.all([
    checkActivityToday(supabase, user.id, todayUtc),
    fetchRooms(supabase, user.id),
    fetchDailyEvent(supabase, user.id, todayUtc),
    loadCrew(supabase, admin, user.id),
    countCommits(supabase, user.id),
    loadUnread(supabase, user.id),
    supabase.from("daily_event_outcomes").select("user_id").eq("user_id", user.id).limit(1),
    fetchLastSyncedAt(admin, user.id),
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
  const me = await fetchMe(supabase, user.id);
  const bytes = me?.bytes ?? null;
  const visuals = await loadUserVisuals(supabase, user.id, rooms);

  // Catch-up: what the crew produced and ate since the last visit.
  const resources = await settleResources(supabase, admin, user.id, crew.forks, rooms);

  // Today's packet and an empty pantry both land on the crew's mood.
  const echo = eventEcho(dailyEvent);
  const moodCtx = { echo, starving: resources.cache === 0 };
  const forks = crew.forks.map((f) => ({ ...f, mood: settleMood(f.mood, moodCtx) }));
  const crewMood = settleMood(crew.mood, moodCtx);

  // "While you were away": what the ledger and the simulation did since the last tick.
  const work = workforce(crew.forks, rooms);
  const alert = resourceAlert({ resources, work, rooms, forks: crew.forks, bytes });
  // One room to staff next, shared by onboarding and the scene's chip: the alert's
  // own room if empty, else (with an idle Fork) power, then kitchen, then bench.
  const staffing = staffingTarget({ alert, rooms, forks: crew.forks });
  // Onboarding speaks of "your idle Fork", so it also needs one to exist.
  const staffingRoom = staffing && crew.forks.some(f => !f.roomSlot) ? staffing : undefined;
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
        visuals={visuals}
        rooms={rooms}
        forks={forks}
        bytes={bytes}
        activeToday={activeToday}
        eventPending={echo === "pending"}
        echo={echo}
        powered={resources.uptime > 0}
        onboarding={{
          notices: packets,
          eventDone: firstEvent.error ? null : (firstEvent.data?.length ?? 0) > 0,
          eventAvailable: dailyEvent !== null,
          staffingRoom: staffingRoom ? { slot: staffingRoom.slot, name: ROOM_CATALOG[staffingRoom.kind].name } : undefined,
        }}
        alert={alert}
        openBuild={!!alert && params.build === alert.roomKind}
        staffing={staffing}
        band={{
          crewLog: (
            <CrewLog
              mood={crewMood}
              lastPushAt={crew.lastPushAt}
              echo={echo}
              forks={crew.forks}
              tip={crewTip({ resources, work, rooms, bytes, alert })}
            />
          ),
          packet: <PacketCard packet={dailyEvent ? (dailyEvent.resolved ? "resolved" : "pending") : null} observedAt={observedAt} />,
        }}
      />
      <TopBar login={githubLogin} bytes={bytes} resources={resources} work={work} lastSyncedAt={lastSyncedAt} alerting={!!alert} />
      {report && <AwaySummary report={report} alerting={!!alert} />}
      <BadgeToast badges={freshBadges} alerting={!!alert} />
      {me !== null && (me.intro_seen_at === null || replayIntro) && <Intro login={githubLogin} />}
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
 * Materialised balance from `users.bytes` (kept in sync by credit_bytes_tx)
 * and whether the intro has played. RLS `users_select_own` scopes this to
 * the caller. Returns null if the row is somehow missing so the HUD can
 * degrade instead of showing "0".
 */
async function fetchMe(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
): Promise<{ bytes: number; intro_seen_at: string | null } | null> {
  const { data } = await supabase.from("users").select("bytes, intro_seen_at").eq("id", userId).maybeSingle();
  return data ?? null;
}

/**
 * When the sync last ran for this player, for the TopBar's "14m". The row
 * is service-role only (no RLS policy for players), so the admin client
 * reads exactly one column of the caller's own row. Null hides the label.
 */
async function fetchLastSyncedAt(admin: ReturnType<typeof createAdminClient>, userId: string): Promise<string | null> {
  const { data } = await admin.from("github_sync_state").select("last_synced_at").eq("user_id", userId).maybeSingle();
  return data?.last_synced_at ?? null;
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
