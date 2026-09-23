import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import type { ReactNode } from "react";

import { recruitFork } from "@/app/forks/actions";
import { SessionBeacon } from "@/components/analytics/SessionBeacon";
import { DailyEventCard } from "@/components/events/DailyEventCard";
import { CrewPanel } from "@/components/rooms/CrewPanel";
import { BenchPanel, BunkPanel, LedgerPanel, LiftPanel, UptimePanel } from "@/components/rooms/RoomPanels";
import { RoomSceneClient } from "@/components/scene/RoomSceneClient";
import { daysBetween } from "@/lib/analytics/track";
import { settleResources } from "@/lib/economy/resources";
import { cacheCap, payloadCap, type TickResult } from "@/lib/economy/tick";
import { fetchDailyEvent, todayUtc } from "@/lib/events/daily";
import { bedCount, RECRUIT_COST, type Fork } from "@/lib/forks/catalog";
import { loadCrew } from "@/lib/forks/load";
import { eventEcho, settleMood } from "@/lib/forks/mood";
import {
  isRoomKind,
  isSlot,
  MAIN_BRANCH_BLURB,
  ROOM_CATALOG,
  type Room,
  type RoomKind,
} from "@/lib/rooms/catalog";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

type Props = { params: Promise<{ slot: string }> };
type Db = Awaited<ReturnType<typeof createClient>>;

export const metadata: Metadata = { title: "Inside the Repo · Git Shelters" };

/**
 * Walk into one room. Slot 0 is the Main Branch, always present; slots
 * 1..3 must hold a built room or the visitor gets the 404 Lands. Each
 * room has one in-world read-out with real data, and a crew roster to
 * put survivors on shift here: a Fork's job is the room it stands in.
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

  const admin = createAdminClient();
  const today = todayUtc();
  const [rooms, crew, activeToday, dailyEvent, { data: me }] = await Promise.all([
    fetchRooms(supabase, user.id),
    loadCrew(supabase, admin, user.id),
    pushedToday(supabase, user.id, today),
    fetchDailyEvent(supabase, user.id, today),
    supabase.from("users").select("bytes").eq("id", user.id).maybeSingle(),
  ]);

  const kind: RoomKind | null = isMain ? null : (rooms.find((r) => r.slot === slotNumber)?.kind ?? null);
  if (!isMain && kind === null) notFound();

  const resources = await settleResources(supabase, admin, user.id, crew.forks, rooms);
  const echo = eventEcho(dailyEvent);
  const moodCtx = { echo, starving: resources.cache === 0 };
  const allForks = crew.forks.map((f) => ({ ...f, mood: settleMood(f.mood, moodCtx) }));
  const forks = allForks.filter((f) => (f.roomSlot ?? 0) === slotNumber);
  const bytes = me?.bytes ?? 0;
  const beds = bedCount(rooms);
  const noBed = allForks.length >= beds;

  const panel = isMain
    ? dailyEvent
      ? <DailyEventCard event={dailyEvent} variant="screen" />
      : undefined
    : await roomPanel(supabase, user, kind!, today, resources, rooms, allForks, forks);

  const title = kind ? ROOM_CATALOG[kind].name : "Main Branch";
  const blurb = kind ? ROOM_CATALOG[kind].blurb : MAIN_BRANCH_BLURB;

  return (
    <main className="relative w-full h-dvh">
      <SessionBeacon />
      <RoomSceneClient
        kind={kind}
        activeToday={activeToday}
        eventPending={echo === "pending"}
        echo={echo}
        panel={panel}
        forks={forks}
        powered={resources.uptime > 0}
      />
      <div className="pointer-events-none absolute top-4 left-4 z-10 font-mono text-sm">
        <h1 className="text-[#BD93F9]">{title}</h1>
        <p className="text-[#E6DFC8]/60">{blurb}</p>
        <Link href="/" className="pointer-events-auto mt-2 inline-block text-[#BD93F9] hover:text-[#E6DFC8]">
          &larr; back to the corridor
        </Link>
        {isMain && (
          <form action={recruitFork} className="pointer-events-auto mt-4">
            <button
              type="submit"
              disabled={noBed || bytes < RECRUIT_COST}
              title={noBed ? "No free bed. Build a Dorm." : bytes < RECRUIT_COST ? `Need ${RECRUIT_COST} B` : "Someone at the door"}
              className="border border-[#BD93F9] px-3 py-1 text-[#BD93F9] transition hover:bg-[#BD93F9]/10 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Recruit a Fork · {RECRUIT_COST} B
            </button>
            <p className="mt-1 text-xs text-[#E6DFC8]/50">
              {allForks.length} {allForks.length === 1 ? "survivor" : "survivors"} in the Repo · {beds} beds
              {noBed && <span className="text-[#A14545]"> · no free bed</span>}
            </p>
          </form>
        )}
        <CrewPanel forks={allForks} rooms={rooms} slot={slotNumber} />
      </div>
    </main>
  );
}

/** The non-terminal read-outs, fed with the settled resources and who works here. */
async function roomPanel(
  supabase: Db,
  user: { id: string; created_at: string },
  kind: RoomKind,
  today: string,
  resources: TickResult,
  rooms: Room[],
  allForks: Fork[],
  here: Fork[],
): Promise<ReactNode> {
  const names = here.map((f) => f.name);
  switch (kind) {
    case "cache_storage": {
      const [{ data: me }, { data: rows }] = await Promise.all([
        supabase.from("users").select("bytes").eq("id", user.id).maybeSingle(),
        supabase
          .from("byte_transactions")
          .select("delta, source, created_at")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(5),
      ]);
      return (
        <LedgerPanel
          bytes={me?.bytes ?? 0}
          rows={rows ?? []}
          cache={resources.cache}
          cacheCap={cacheCap(rooms.filter((r) => r.kind === "cache_storage").length)}
          cooks={names}
        />
      );
    }
    case "power_plant": {
      const [{ data: sync }, live] = await Promise.all([
        supabase
          .from("byte_transactions")
          .select("created_at")
          .eq("user_id", user.id)
          .in("source", ["github_sync", "backfill"])
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
        pushedToday(supabase, user.id, today),
      ]);
      return (
        <UptimePanel
          days={daysBetween(Date.parse(user.created_at), Date.now())}
          lastSyncAt={sync?.created_at ?? null}
          pushedToday={live}
          uptime={resources.uptime}
          engineers={names}
        />
      );
    }
    case "dorm":
      return <BunkPanel beds={bedCount(rooms)} crew={allForks.length} sleepers={names} />;
    case "elevator":
      return <LiftPanel lowerRooms={rooms.filter((r) => r.slot >= 5).length} operators={names} />;
    case "workshop":
      return (
        <BenchPanel
          payload={resources.payload}
          cap={payloadCap(rooms.filter((r) => r.kind === "workshop").length)}
          tinkerers={names}
          powered={resources.uptime > 0}
        />
      );
  }
}

async function fetchRooms(supabase: Db, userId: string): Promise<Room[]> {
  const { data } = await supabase.from("rooms").select("slot, kind").eq("user_id", userId);
  return (data ?? []).flatMap(({ slot, kind }) => (isSlot(slot) && isRoomKind(kind) ? [{ slot, kind }] : []));
}

async function pushedToday(supabase: Db, userId: string, today: string): Promise<boolean> {
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
