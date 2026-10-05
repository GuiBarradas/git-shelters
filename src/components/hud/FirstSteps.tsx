"use client";

import Link from "next/link";

import { Packets } from "@/components/hud/Packets";
import { WELCOME, type Notice } from "@/lib/notices";
import { ROOM_CATALOG } from "@/lib/rooms/catalog";

export type FirstStepsState = {
  notices: Notice[];
  /** null means the history could not be loaded; don't invent missing progress. */
  eventDone: boolean | null;
  eventAvailable: boolean;
  staffingRoom?: { slot: number; name: string };
};

export function FirstSteps({ notices, eventDone, eventAvailable, built, bytes, onBuild, staffingRoom }: FirstStepsState & {
  built: boolean;
  bytes: number | null;
  onBuild: () => void;
}) {
  const welcome = notices.some((n) => n.ref === WELCOME.ref);
  const guide = eventDone !== null && (!built || !eventDone);
  if (!guide && notices.length === 0) return null;

  const cost = ROOM_CATALOG.cache_storage.cost;
  const ready = bytes !== null && bytes >= cost;
  return (
    <aside aria-label="Getting started" className="absolute bottom-14 left-4 right-4 z-10 max-h-[45dvh] space-y-3 overflow-y-auto border border-[#BD93F9]/60 bg-[#0B0713]/95 p-4 font-mono text-xs text-[#E6DFC8] shadow-lg sm:right-auto sm:w-80">
      {guide && (
        <>
          <h2 className="text-sm text-[#BD93F9]">Get your Repo running</h2>
          <ol aria-label="First steps" className="flex flex-wrap gap-x-3 gap-y-1 text-[11px]">
            <li className={welcome ? "text-[#E67E22]" : "text-[#E6DFC8]/60"}>{welcome ? "1." : "✓"} Collect Bytes</li>
            <li className={built ? "text-[#E6DFC8]/60" : ""}>{built ? "✓" : "2."} Build a room</li>
            <li className={eventDone ? "text-[#E6DFC8]/60" : ""}>{eventDone ? "✓" : "3."} Resolve an event</li>
          </ol>
        </>
      )}
      <Packets notices={notices} />
      {guide && !welcome && (!built ? (
        <div>
          <p className="mb-3 leading-relaxed">Cache Storage costs {cost} B. Assign your free Fork inside to cook while there is power. Save for a Power Plant next; a Dorm can wait.</p>
          <button type="button" onClick={onBuild} disabled={bytes === null}
            className="min-h-11 w-full border border-[#BD93F9] px-3 py-2 text-[#BD93F9] hover:bg-[#BD93F9]/10 focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-50">
            {ready ? "Choose your first room" : "See room costs"}
          </button>
          {!ready && <p className="mt-2 text-[#E6DFC8]/70">{bytes === null ? "Your balance is unavailable. Reload to try again." : `You need ${cost - bytes} more B for Cache Storage. Public GitHub pushes earn Bytes; today's event may also help.`}</p>}
          {!ready && !eventDone && eventAvailable && <Link href="/room/0" className="mt-2 inline-block py-2 text-[#BD93F9] underline">Read today&apos;s event</Link>}
        </div>
      ) : (
        <div>
          {staffingRoom && <div className="mb-3 space-y-2"><p className="text-[#E67E22]">You have an idle Fork. Your {staffingRoom.name} needs a worker before it can produce.</p><Link href={`/room/${staffingRoom.slot}`} className="block min-h-11 border border-[#E67E22] px-3 py-3 text-center text-[#E67E22]">Assign your first worker · free</Link></div>}
          {!eventDone && <><p className="mb-3 leading-relaxed">Your first room is built. The Main Branch terminal has a daily decision for you.</p>
          {eventAvailable ? <Link href="/room/0" className="block min-h-11 border border-[#BD93F9] px-3 py-3 text-center text-[#BD93F9] hover:bg-[#BD93F9]/10">Read your first event</Link> : <p role="status">The terminal is unavailable. Reload to try again.</p>}</>}
        </div>
      ))}
    </aside>
  );
}
