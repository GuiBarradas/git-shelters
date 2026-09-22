"use client";

import dynamic from "next/dynamic";
import type { ReactNode } from "react";

import type { RoomKind } from "@/lib/rooms/catalog";

const RoomScene = dynamic(() => import("./RoomScene"), { ssr: false });

type Props = {
  kind: RoomKind | null;
  activeToday: boolean;
  eventPending: boolean;
  panel?: ReactNode;
};

/** Client boundary for the room interior; the page passes the terminal content as children. */
export function RoomSceneClient(props: Props) {
  return (
    <>
      <RoomScene {...props} />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{ background: "radial-gradient(ellipse at center, transparent 60%, rgba(0,0,0,0.6) 100%)" }}
      />
    </>
  );
}
