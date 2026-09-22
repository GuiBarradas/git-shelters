"use client";

import dynamic from "next/dynamic";
import { useEffect, useState, type ReactNode } from "react";

import { FORK_TRAITS, type Fork as ForkData } from "@/lib/forks/catalog";
import type { RoomKind } from "@/lib/rooms/catalog";

import { SpeechBubble } from "./BunkerSceneClient";

const RoomScene = dynamic(() => import("./RoomScene"), { ssr: false });

type Props = {
  kind: RoomKind | null;
  activeToday: boolean;
  eventPending: boolean;
  panel?: ReactNode;
  forks?: ForkData[];
};

/** Client boundary for the room interior; the page passes the terminal content as children. */
export function RoomSceneClient(props: Props) {
  const [speech, setSpeech] = useState<{ name: string; line: string } | null>(null);
  const [hovered, setHovered] = useState<ForkData | null>(null);

  useEffect(() => {
    if (!speech) return;
    const id = setTimeout(() => setSpeech(null), 3500);
    return () => clearTimeout(id);
  }, [speech]);

  return (
    <>
      <RoomScene
        {...props}
        onForkClick={(f) => setSpeech({ name: f.name, line: FORK_TRAITS[f.trait].line })}
        onForkHover={setHovered}
      />
      {speech ? (
        <SpeechBubble name={speech.name} line={speech.line} />
      ) : hovered ? (
        <p className="pointer-events-none absolute bottom-6 left-1/2 z-10 -translate-x-1/2 whitespace-nowrap border border-[#7FFF6A]/40 bg-[#0F0F0F]/90 px-3 py-1 font-mono text-xs text-[#E6DFC8]">
          {hovered.name} · {FORK_TRAITS[hovered.trait].name}
          <span className="text-[#E6DFC8]/50"> · click to talk</span>
        </p>
      ) : null}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{ background: "radial-gradient(ellipse at center, transparent 60%, rgba(0,0,0,0.6) 100%)" }}
      />
    </>
  );
}
