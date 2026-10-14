"use client";

import Link from "next/link";
import type { ReactNode } from "react";

import { Packets } from "@/components/hud/Packets";
import { WELCOME, type Notice } from "@/lib/notices";
import { ROOM_CATALOG } from "@/lib/rooms/catalog";

export type FirstStepsState = {
  notices: Notice[];
  /** null means the history could not be loaded; don't invent missing progress. */
  eventDone: boolean | null;
  eventAvailable: boolean;
  /** A room that needs the idle Fork; only set when a Fork really is idle. */
  staffingRoom?: { slot: number; name: string };
};

/**
 * Onboarding in the lower-left slot. When there is nothing to guide or
 * collect it gives the slot to `fallback` (the CrewLog), so the two never
 * show together and finished onboarding never comes back for an idle Fork.
 */
export function FirstSteps({ notices, eventDone, eventAvailable, built, bytes, onBuild, staffingRoom, fallback = null }: FirstStepsState & {
  built: boolean;
  bytes: number | null;
  onBuild: () => void;
  fallback?: ReactNode;
}) {
  const welcome = notices.some((n) => n.ref === WELCOME.ref);
  const guide = eventDone !== null && (!built || !eventDone);
  if (!guide && notices.length === 0) return fallback;

  const cost = ROOM_CATALOG.cache_storage.cost;
  const ready = bytes !== null && bytes >= cost;
  return (
    <aside aria-label="Getting started" className="pointer-events-auto max-h-[32dvh] w-full space-y-3 overflow-y-auto border border-hud-violet/60 bg-hud-bg/95 p-4 font-mono text-xs text-hud-bone sm:max-h-[45dvh] xl:w-[380px]">
      {guide && (
        <>
          <h2 className="text-sm text-hud-violet">Get your Repo running</h2>
          <ol aria-label="First steps" className="flex flex-wrap gap-x-3 gap-y-1 text-[11px]">
            <li className={welcome ? "text-hud-amber" : "text-hud-bone/60"}>{welcome ? "1." : "✓"} Collect Bytes</li>
            <li className={built ? "text-hud-bone/60" : ""}>{built ? "✓" : "2."} Build a room</li>
            <li className={eventDone ? "text-hud-bone/60" : ""}>{eventDone ? "✓" : "3."} Resolve an event</li>
          </ol>
        </>
      )}
      <Packets notices={notices} />
      {guide && !welcome && (!built ? (
        <div>
          <p className="mb-3 leading-relaxed">Cache Storage costs {cost} B. Assign your free Fork inside to cook while there is power. Save for a Power Plant next; a Dorm can wait.</p>
          <button type="button" onClick={onBuild} disabled={bytes === null}
            className="min-h-11 w-full border border-hud-violet px-3 py-2 text-hud-violet hover:bg-hud-violet/10 disabled:opacity-50">
            {ready ? "Choose your first room" : "See room costs"}
          </button>
          {!ready && <p className="mt-2 text-hud-bone/70">{bytes === null ? "Your balance is unavailable. Reload to try again." : `You need ${cost - bytes} more B for Cache Storage. Public GitHub pushes earn Bytes; today's event may also help.`}</p>}
          {!ready && !eventDone && eventAvailable && <Link href="/room/0" prefetch={false} className="mt-2 inline-block py-2 text-hud-violet underline">Read today&apos;s event</Link>}
        </div>
      ) : (
        <div>
          {staffingRoom && <div className="mb-3 space-y-2"><p className="text-hud-amber">You have an idle Fork. Your {staffingRoom.name} needs a worker before it can produce.</p><Link href={`/room/${staffingRoom.slot}`} prefetch={false} className="block min-h-11 border border-hud-amber px-3 py-3 text-center text-hud-amber">Assign your first worker · free</Link></div>}
          {!eventDone && <><p className="mb-3 leading-relaxed">Your first room is built. The Main Branch terminal has a daily decision for you.</p>
          {eventAvailable ? <Link href="/room/0" prefetch={false} className="block min-h-11 border border-hud-violet px-3 py-3 text-center text-hud-violet hover:bg-hud-violet/10">Read your first event</Link> : <p role="status">The terminal is unavailable. Reload to try again.</p>}</>}
        </div>
      ))}
    </aside>
  );
}
