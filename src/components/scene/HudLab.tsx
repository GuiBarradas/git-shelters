"use client";

import { useMemo, useState, type MouseEvent, type ReactNode } from "react";

import { NextPacket } from "@/components/events/NextPacket";
import { AlertBanner } from "@/components/hud/AlertBanner";
import { CrewLog } from "@/components/hud/CrewLog";
import { crewTip } from "@/components/hud/crewTip";
import { PacketCard } from "@/components/hud/PacketCard";
import { resourceAlert, staffingTarget } from "@/components/hud/resourceAlert";
import { TopBar } from "@/components/hud/TopBar";
import { CrewPanel } from "@/components/rooms/CrewPanel";
import { BenchPanel, BunkPanel, LedgerPanel, LiftPanel, UptimePanel } from "@/components/rooms/RoomPanels";
import { workforce } from "@/lib/economy/resources";
import { cacheCap, payloadCap, type ResourceState } from "@/lib/economy/tick";
import { nextPacketAt } from "@/lib/events/schedule";
import { bedCount, type Fork } from "@/lib/forks/catalog";
import type { EventEcho, Mood } from "@/lib/forks/mood";
import { MAIN_BRANCH_BLURB, ROOM_CATALOG, type Room } from "@/lib/rooms/catalog";
import { generateBunker } from "@/lib/visuals/generate";

import { BunkerSceneClient } from "./BunkerSceneClient";
import { PersistentViewport } from "./BunkerViewport";
import { BackToCorridor, RoomSceneClient } from "./RoomSceneClient";

export type HudFixtureKind = "normal" | "blackout";

const MINUTE = 60_000;
const ago = (iso: string, ms: number) => new Date(Date.parse(iso) - ms).toISOString();

/** Five built rooms around the Main Branch: both floors, so the pager and the lift have something to show. */
const ROOMS: Room[] = [
  { slot: 1, kind: "cache_storage" },
  { slot: 2, kind: "power_plant" },
  { slot: 3, kind: "dorm" },
  { slot: 4, kind: "elevator" },
  { slot: 5, kind: "workshop" },
];

/**
 * Synthetic HUD states for visual QA, NOT a player's stats: the numbers
 * match the design brief's artboards (cache 160, uptime 100, payload 30,
 * 1,709 B) and "GuiBarradas" is the reference login from the artboards.
 * Everything derives from `observedAt`, so a fixed `?at=` gives stable
 * screenshots. No database, no auth: the rest of the HUD reads it
 * through the same helpers the real pages use.
 */
export function hudFixture(kind: HudFixtureKind, observedAt: string) {
  const blackout = kind === "blackout";
  const mood: Mood = blackout ? "stressed" : "happy";
  const forks: Fork[] = [
    { id: "fixture-1", name: "Ada", trait: "caffeinated", mood, roomSlot: 1, seed: 11 },
    // The Engineer: on shift normally, idle in the blackout.
    { id: "fixture-2", name: "Linus", trait: "senior", mood, roomSlot: blackout ? null : 2, seed: 23 },
    { id: "fixture-3", name: "Grace", trait: "junior", mood, roomSlot: 3, seed: 37 },
    { id: "fixture-4", name: "Ken", trait: "minimalist", mood, roomSlot: 5, seed: 41 },
  ];
  const resources: ResourceState = blackout ? { cache: 12, uptime: 0, payload: 30 } : { cache: 160, uptime: 100, payload: 30 };
  const bytes = 1709;
  const work = workforce(forks, ROOMS);
  const alert = resourceAlert({ resources, work, rooms: ROOMS, forks, bytes });
  const echo: EventEcho = blackout ? "pending" : "good";
  return {
    login: "GuiBarradas",
    rooms: ROOMS,
    forks,
    mood,
    echo,
    bytes,
    resources,
    work,
    alert,
    staffing: staffingTarget({ alert, rooms: ROOMS, forks }),
    tip: crewTip({ resources, work, rooms: ROOMS, bytes, alert }),
    packet: blackout ? ("pending" as const) : ("resolved" as const),
    // Pushed 3 h ago (normal) or yesterday (blackout).
    activeToday: !blackout,
    lastPushAt: ago(observedAt, blackout ? 26 * 60 * MINUTE : 3 * 60 * MINUTE),
    lastSyncedAt: ago(observedAt, blackout ? 120 * MINUTE : 14 * MINUTE),
  };
}

/**
 * Where a click in the fixture may go: `room` for /room/<n> and "/" (walked
 * locally), `allow` for blob downloads, `block` for everything else
 * (map, profile, settings, legal, intro replay) and for the share upload.
 */
export function fixtureClick(target: Element): { action: "room"; slot: number | null } | { action: "allow" } | { action: "block" } | null {
  if (target.closest("[data-share-publish]")) return { action: "block" };
  const link = target.closest("a[href]");
  if (!link) return null;
  const href = link.getAttribute("href")!;
  if (href.startsWith("blob:")) return { action: "allow" };
  if (href === "/") return { action: "room", slot: null };
  const room = /^\/room\/(\d+)$/.exec(href);
  return room ? { action: "room", slot: Number(room[1]) } : { action: "block" };
}

/** A fixed `?at=` ISO time (lab only) or the client's clock. */
export function fixtureTime(at: string | null): string {
  return at && Number.isFinite(Date.parse(at)) ? new Date(at).toISOString() : new Date().toISOString();
}

function roomPanel(slot: number, data: ReturnType<typeof hudFixture>): ReactNode {
  const here = data.forks.filter((f) => (f.roomSlot ?? 0) === slot).map((f) => f.name);
  switch (data.rooms.find((r) => r.slot === slot)?.kind) {
    case "cache_storage": return <LedgerPanel bytes={data.bytes} rows={[]} cache={data.resources.cache} cacheCap={cacheCap(data.work.cacheStorages)} cooks={here} />;
    case "power_plant": return <UptimePanel days={30} lastSyncAt={data.lastSyncedAt} pushedToday={data.activeToday} uptime={data.resources.uptime} engineers={here} />;
    case "dorm": return <BunkPanel beds={bedCount(data.rooms)} crew={data.forks.length} sleepers={here} />;
    case "elevator": return <LiftPanel lowerRooms={1} operators={here} />;
    case "workshop": return <BenchPanel payload={data.resources.payload} cap={payloadCap(data.work.workshops)} tinkerers={here} powered={data.resources.uptime > 0} />;
    // The Main Branch terminal needs a real Daily Event; the fixture invents none.
    default: return undefined;
  }
}

/**
 * `/dev/scene-lab?hud=normal|blackout[&at=ISO]`: the real TopBar, scene,
 * lower band and room HUD over one PersistentViewport, fed by
 * {@link hudFixture}. Read-only by construction: every form submit (all
 * Server Actions: build, sync, sign-out, assign) is cancelled before React
 * runs its action, the share upload is blocked by its `data-share-publish`
 * marker, and links other than rooms, the corridor and blob downloads go
 * nowhere. Rooms open locally, so the persistent renderer never reloads.
 */
export function HudLab({ fixture, at, seed }: { fixture: HudFixtureKind; at: string | null; seed: number }) {
  const [observedAt] = useState(() => fixtureTime(at));
  const data = useMemo(() => hudFixture(fixture, observedAt), [fixture, observedAt]);
  const visuals = useMemo(() => generateBunker(seed, { recentActivity: 1 }, [{ slot: 0, kind: "main" }, ...data.rooms]), [seed, data.rooms]);
  const [room, setRoom] = useState<number | null>(null);
  const alerting = !!data.alert;

  const guard = (e: MouseEvent) => {
    const verdict = fixtureClick(e.target as Element);
    if (!verdict || verdict.action === "allow") return;
    e.preventDefault();
    if (verdict.action === "block") e.stopPropagation();
    else setRoom(verdict.slot);
  };

  const kind = room === null ? null : (data.rooms.find((r) => r.slot === room)?.kind ?? null);
  return (
    <div data-hud-lab={fixture} onClickCapture={guard} onSubmitCapture={(e) => e.preventDefault()}>
      <PersistentViewport>
        <div className="relative h-dvh w-full">
          <TopBar login={data.login} bytes={data.bytes} resources={data.resources} work={data.work} lastSyncedAt={data.lastSyncedAt} alerting={alerting} />
          {room === null ? (
            <BunkerSceneClient
              visuals={visuals}
              rooms={data.rooms}
              forks={data.forks}
              bytes={data.bytes}
              activeToday={data.activeToday}
              eventPending={data.packet === "pending"}
              echo={data.echo}
              powered={data.resources.uptime > 0}
              alert={data.alert}
              staffing={data.staffing}
              onNavigate={setRoom}
              band={{
                crewLog: <CrewLog mood={data.mood} lastPushAt={data.lastPushAt} echo={data.echo} forks={data.forks} tip={data.tip} />,
                packet: <PacketCard packet={data.packet} observedAt={observedAt} />,
              }}
            />
          ) : (
            <>
              <RoomSceneClient
                rooms={data.rooms}
                visuals={visuals}
                slot={room}
                kind={kind}
                activeToday={data.activeToday}
                eventPending={data.packet === "pending"}
                echo={data.echo}
                panel={roomPanel(room, data)}
                forks={data.forks}
                powered={data.resources.uptime > 0}
                alerting={alerting}
              />
              {data.alert && <AlertBanner alert={data.alert} currentSlot={room} />}
              {/* Mirrors the room page's header column; the recruit form is left out. */}
              <div className={`pointer-events-none absolute ${alerting ? "top-[168px] lg:top-[116px]" : "top-[124px] lg:top-[72px]"} left-4 z-10 font-mono text-sm`}>
                <h1 className="text-hud-violet">{kind ? ROOM_CATALOG[kind].name : "Main Branch"}</h1>
                <p className="text-hud-bone/60">{kind ? ROOM_CATALOG[kind].blurb : MAIN_BRANCH_BLURB}</p>
                <BackToCorridor />
                <CrewPanel forks={data.forks} rooms={data.rooms} slot={room} />
              </div>
              {room === 0 && data.packet === "resolved" && (
                <div data-hud className="absolute bottom-14 left-4 right-4 z-10 border border-hud-violet/40 bg-hud-bg/95 p-4 font-mono text-xs sm:left-auto sm:w-80">
                  <NextPacket observedAt={observedAt} availableAt={nextPacketAt(observedAt)} />
                </div>
              )}
            </>
          )}
        </div>
      </PersistentViewport>
    </div>
  );
}
