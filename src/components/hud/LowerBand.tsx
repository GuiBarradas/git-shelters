"use client";

import { Fragment, type ReactNode } from "react";

import { usePhone } from "@/components/scene/hudInset";

/**
 * The overview's lower band. Phone: pager, log, packet, then the dock full
 * width on the bottom edge (20 px more air above it). From sm one row (log,
 * dock, packet), compact until xl. The DOM follows that visual order at the
 * current breakpoint so Tab does too; keyed fragments move without
 * remounting. The dock's `max-sm:order-last` only covers the first paint,
 * before hydration swaps the server's (desktop) order.
 */
export function LowerBand({ bandRef, pager, log, logHidden, packet, dock }: {
  bandRef: (el: HTMLElement | null) => void;
  pager: ReactNode;
  log: ReactNode;
  /** Behind the build menu: hidden, not unmounted, so the band keeps its height and the camera stays put. */
  logHidden: boolean;
  packet: ReactNode;
  dock: ReactNode;
}) {
  const items: Record<string, ReactNode> = {
    log: <div className={`min-w-0 px-4 sm:px-0 xl:justify-self-start ${logHidden ? "invisible" : ""}`}>{log}</div>,
    packet: <div className="min-w-0 px-4 sm:px-0 xl:justify-self-end">{packet}</div>,
    dock: <div className="max-sm:order-last max-sm:mt-5">{dock}</div>,
  };
  const order = usePhone() ? ["log", "packet", "dock"] : ["log", "dock", "packet"];
  return (
    <div ref={bandRef} data-hud className="pointer-events-none absolute inset-x-0 bottom-0 z-10 flex flex-col gap-2 sm:grid sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] sm:items-end sm:gap-4 sm:px-4 sm:pb-[max(1rem,env(safe-area-inset-bottom))] xl:px-6 xl:pb-6">
      {pager}
      {order.map((key) => <Fragment key={key}>{items[key]}</Fragment>)}
    </div>
  );
}
