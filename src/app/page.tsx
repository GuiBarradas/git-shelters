import * as Sentry from "@sentry/nextjs";

import { AuthBar } from "@/components/auth/AuthBar";
import { DailyEventCard, type DailyEventView } from "@/components/events/DailyEventCard";
import { BunkerSceneClient } from "@/components/scene/BunkerSceneClient";
import { parseOption } from "@/lib/events/option";
import { isRoomKind, isSlot, type Room } from "@/lib/rooms/catalog";
import { createClient } from "@/lib/supabase/server";

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Supabase populates user_metadata from the OAuth provider profile.
  // For GitHub, `user_name` is the @handle (e.g. "GuiBarradas").
  const githubLogin =
    typeof user?.user_metadata?.user_name === "string"
      ? user.user_metadata.user_name
      : null;

  // Main Branch tint is driven by persisted state, not a live GitHub fetch.
  // Anyone who pushed today will have at least one byte_transactions row
  // tagged source = 'github_sync' with created_at on today's UTC date.
  // The sync server action (src/app/sync/actions.ts) is what populates it.
  const todayUtc = new Date().toISOString().slice(0, 10);
  const [activeToday, bytes, rooms, dailyEvent] = user
    ? await Promise.all([
        checkActivityToday(supabase, user.id, todayUtc),
        fetchBytes(supabase, user.id),
        fetchRooms(supabase, user.id),
        fetchDailyEvent(supabase, user.id, todayUtc),
      ])
    : [false, null, [], null];

  return (
    <main className="relative w-full h-dvh">
      <BunkerSceneClient rooms={rooms} bytes={bytes} activeToday={activeToday} />
      <div className="pointer-events-none absolute top-4 right-4 z-10">
        <AuthBar githubLogin={githubLogin} bytes={bytes} />
      </div>
      {dailyEvent && (
        <div className="pointer-events-none absolute bottom-6 left-6 z-10">
          <DailyEventCard event={dailyEvent} />
        </div>
      )}
    </main>
  );
}

/**
 * Today's Daily Event for the player (ADR 0002): the id comes from the
 * same `pick_daily_event` SQL function the resolve RPC uses, then the
 * catalog row and today's outcome (if any) are read in parallel.
 *
 * An empty pool is a P1 by design — it means nobody can play today — so
 * it is reported to Sentry and the card is simply not rendered.
 */
async function fetchDailyEvent(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  todayUtc: string,
): Promise<DailyEventView | null> {
  const { data: eventId } = await supabase.rpc("pick_daily_event", {
    p_user_id: userId,
  });
  if (!eventId) {
    Sentry.captureMessage("daily_event_pool_empty", "error");
    return null;
  }

  const [{ data: event }, { data: outcome }] = await Promise.all([
    supabase
      .from("daily_events_catalog")
      .select("title, narrative, option_a, option_b")
      .eq("id", eventId)
      .maybeSingle(),
    supabase
      .from("daily_event_outcomes")
      .select("choice, outcome_json")
      .eq("user_id", userId)
      .eq("resolved_on", todayUtc)
      .maybeSingle(),
  ]);

  const a = parseOption(event?.option_a);
  const b = parseOption(event?.option_b);
  if (!event || !a || !b) {
    Sentry.captureMessage(`daily_event_malformed: ${eventId}`, "error");
    return null;
  }

  const rawChoice = outcome?.choice;
  const choice: "a" | "b" | null = rawChoice === "a" || rawChoice === "b" ? rawChoice : null;
  const resolvedOutcome = parseOption(outcome?.outcome_json);
  const resolved = choice && resolvedOutcome ? { choice, outcome: resolvedOutcome } : null;

  return { title: event.title, narrative: event.narrative, options: { a, b }, resolved };
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
  const { data } = await supabase
    .from("rooms")
    .select("slot, kind")
    .eq("user_id", userId);

  return (data ?? []).flatMap(({ slot, kind }) =>
    isSlot(slot) && isRoomKind(kind) ? [{ slot, kind }] : [],
  );
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
  const { data } = await supabase
    .from("users")
    .select("bytes")
    .eq("id", userId)
    .maybeSingle();
  return data?.bytes ?? null;
}

/**
 * Checks if the user has at least one `github_sync` byte_transactions row
 * for the given UTC date. Cheap query — one indexed lookup, head-only.
 *
 * The upper bound is the next day's midnight UTC (exclusive) rather than
 * 23:59:59.999 — that 1ms window would silently drop rows landing exactly
 * on the boundary. Pedantic but correct.
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
    .eq("source", "github_sync")
    .gte("created_at", `${todayUtc}T00:00:00Z`)
    .lt("created_at", `${tomorrowUtc}T00:00:00Z`);

  return (count ?? 0) > 0;
}

function nextUtcDate(yyyyMmDd: string): string {
  const ms = Date.parse(`${yyyyMmDd}T00:00:00Z`) + 86_400_000;
  return new Date(ms).toISOString().slice(0, 10);
}
