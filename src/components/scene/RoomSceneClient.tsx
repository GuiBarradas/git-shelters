"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";

import type { GeneratedBunker } from "@/lib/visuals/types";
import { FORK_TRAITS, type Fork as ForkData } from "@/lib/forks/catalog";
import { type EventEcho, JOB_LINES, pickLine } from "@/lib/forks/mood";
import type { Room, RoomKind } from "@/lib/rooms/catalog";

import { hudInset, SpeechBubble } from "./BunkerSceneClient";
import { RegisteredBunkerScene, useBunkerFocus } from "./BunkerViewport";

type Props = {
  kind: RoomKind | null;
  rooms: Room[];
  visuals?: GeneratedBunker | null;
  slot?: number;
  activeToday: boolean;
  eventPending: boolean;
  echo?: EventEcho | null;
  panel?: ReactNode;
  forks?: ForkData[];
  powered?: boolean;
  /** An AlertBanner sits under the TopBar: the close-up leaves 100 px at the top, not 56. */
  alerting?: boolean;
};

/** Client boundary for the room interior; the page passes the terminal content as children. */
export function RoomSceneClient(props: Props) {
  const [speech, setSpeech] = useState<{ name: string; line: string } | null>(null);
  const [hovered, setHovered] = useState<string | null>(null);
  const [pokes, setPokes] = useState(0);

  useEffect(() => {
    if (!speech) return;
    const id = setTimeout(() => setSpeech(null), 3500);
    return () => clearTimeout(id);
  }, [speech]);

  return (
    <>
      <RegisteredBunkerScene
        {...props}
        focusedSlot={props.slot ?? 0}
        hudInset={hudInset(!!props.alerting, false, true)}
        onSlotClick={() => {}}
        onForkClick={(f) => {
          setPokes((n) => n + 1);
          setSpeech({
            name: f.name,
            line: pickLine(f.seed, pokes, f.mood, FORK_TRAITS[f.trait].lines, props.echo ?? null, JOB_LINES[props.kind ?? "off_shift"]),
          });
        }}
        onHoverBlurb={setHovered}
      />
      {speech ? (
        <SpeechBubble name={speech.name} line={speech.line} />
      ) : hovered ? (
        <p className="pointer-events-none absolute bottom-6 left-1/2 z-10 -translate-x-1/2 whitespace-nowrap border border-[#BD93F9]/40 bg-[#0B0713]/90 px-3 py-1 font-mono text-xs text-[#E6DFC8]">
          {hovered}
          <span className="text-[#E6DFC8]/50"> · click to talk</span>
        </p>
      ) : null}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{ background: "radial-gradient(ellipse at center, transparent 60%, rgba(0,0,0,0.15) 100%)" }}
      />
    </>
  );
}

export function BackToCorridor() {
  const focus = useBunkerFocus();
  return <Link href="/" prefetch={false}
    onNavigate={() => focus?.(null)}
    className="pointer-events-auto mt-2 inline-block text-[#BD93F9] hover:text-[#E6DFC8]">
    &larr; back to the corridor
  </Link>;
}
