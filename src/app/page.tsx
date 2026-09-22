import { AuthBar } from "@/components/auth/AuthBar";
import { BunkerSceneClient } from "@/components/scene/BunkerSceneClient";
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
  const [activeToday, bytes, rooms] = user
    ? await Promise.all([
        checkActivityToday(supabase, user.id, todayUtc),
        fetchBytes(supabase, user.id),
        fetchRooms(supabase, user.id),
      ])
    : [false, null, []];

  return (
    <main className="relative w-full h-dvh">
      <BunkerSceneClient rooms={rooms} bytes={bytes} activeToday={activeToday} />
      <div className="pointer-events-none absolute top-4 right-4 z-10">
        <AuthBar githubLogin={githubLogin} bytes={bytes} />
      </div>
    </main>
  );
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
