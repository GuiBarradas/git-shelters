import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { SessionBeacon } from "@/components/analytics/SessionBeacon";
import { DailyEventCard } from "@/components/events/DailyEventCard";
import { RoomSceneClient } from "@/components/scene/RoomSceneClient";
import { fetchDailyEvent, todayUtc } from "@/lib/events/daily";
import { isRoomKind, isSlot, MAIN_BRANCH_BLURB, ROOM_CATALOG, type RoomKind } from "@/lib/rooms/catalog";
import { createClient } from "@/lib/supabase/server";

type Props = { params: Promise<{ slot: string }> };

export const metadata: Metadata = { title: "Inside the Repo · Git Shelters" };

/**
 * Walk into one room. Slot 0 is the Main Branch, always present; slots
 * 1..3 must hold a built room or the visitor gets the 404 Lands. The
 * Main Branch terminal carries today's Daily Event.
 */
export default async function RoomPage({ params }: Props) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/");

  const slotNumber = Number((await params).slot);
  const isMain = slotNumber === 0;
  if (!isMain && !isSlot(slotNumber)) notFound();

  let kind: RoomKind | null = null;
  if (!isMain) {
    const { data } = await supabase
      .from("rooms")
      .select("kind")
      .eq("user_id", user.id)
      .eq("slot", slotNumber)
      .maybeSingle();
    if (!data || !isRoomKind(data.kind)) notFound();
    kind = data.kind;
  }

  const today = todayUtc();
  const [dailyEvent, activeToday] = isMain
    ? await Promise.all([fetchDailyEvent(supabase, user.id, today), pushedToday(supabase, user.id, today)])
    : [null, false];

  const title = kind ? ROOM_CATALOG[kind].name : "Main Branch";
  const blurb = kind ? ROOM_CATALOG[kind].blurb : MAIN_BRANCH_BLURB;

  return (
    <main className="relative w-full h-dvh">
      <SessionBeacon />
      <RoomSceneClient
        kind={kind}
        activeToday={activeToday}
        eventPending={Boolean(dailyEvent && !dailyEvent.resolved)}
        screen={dailyEvent ? <DailyEventCard event={dailyEvent} variant="screen" /> : undefined}
      />
      <div className="pointer-events-none absolute top-4 left-4 z-10 font-mono text-sm">
        <h1 className="text-[#7FFF6A]">{title}</h1>
        <p className="text-[#E6DFC8]/60">{blurb}</p>
        <Link href="/" className="pointer-events-auto mt-2 inline-block text-[#7FFF6A] hover:text-[#E6DFC8]">
          &larr; back to the corridor
        </Link>
      </div>
    </main>
  );
}

async function pushedToday(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  today: string,
): Promise<boolean> {
  const tomorrow = new Date(Date.parse(`${today}T00:00:00Z`) + 86_400_000).toISOString().slice(0, 10);
  const { count } = await supabase
    .from("byte_transactions")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .in("source", ["github_sync", "backfill"])
    .gte("created_at", `${today}T00:00:00Z`)
    .lt("created_at", `${tomorrow}T00:00:00Z`);
  return (count ?? 0) > 0;
}
