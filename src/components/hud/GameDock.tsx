"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";

import { ShareDialog } from "@/components/scene/procedural/BunkerShare";
import type { Fork } from "@/lib/forks/catalog";
import type { GeneratedBunker } from "@/lib/visuals/types";

// Phones: the items share the full width. sm..xl compact, then the 92 px desktop items.
const ITEM = "flex h-16 min-w-0 flex-1 flex-col sm:w-20 sm:flex-none xl:w-[92px] items-center justify-center gap-1.5 text-[10px] uppercase tracking-[0.22em] hover:bg-hud-violet/10";
const IDLE = `${ITEM} border-b-2 border-transparent text-hud-bone/70 hover:text-hud-bone`;

function Icon({ d }: { d: string }) {
  return (
    <svg aria-hidden viewBox="0 0 16 16" className="h-4 w-4 fill-none stroke-current text-hud-violet" strokeWidth={1.4}>
      <path d={d} />
    </svg>
  );
}

/** One label under one icon. */
function Item({ icon, label }: { icon: string; label: ReactNode }) {
  return <><Icon d={icon} />{label}</>;
}

/**
 * Bottom-centre navigation for the bunker overview: the bunker itself, the
 * world map, and the share card when there are visuals to render. Crew and
 * Badges wait for their own screens. On phones it spans the bottom edge,
 * clear of the home indicator.
 */
export function GameDock({ share }: { share: { bunker: GeneratedBunker; forks: Fork[] } | null }) {
  const [sharing, setSharing] = useState(false);
  return (
    <nav aria-label="Game" className="pointer-events-auto flex border-t border-hud-violet/40 bg-hud-bg/95 pb-[env(safe-area-inset-bottom)] font-mono sm:border sm:pb-0">
      <Link href="/" aria-current="page" className={`${ITEM} border-b-2 border-hud-violet bg-hud-violet/14 text-hud-bone`}>
        <Item icon="M2 2h5v5H2zM9 2h5v5H9zM2 9h5v5H2zM9 9h5v5H9z" label="Bunker" />
      </Link>
      <Link href="/map" className={IDLE}>
        <Item icon="M1.5 3.5 5.5 2l5 1.5 4-1.5v10.5l-4 1.5-5-1.5-4 1.5zM5.5 2v10.5M10.5 3.5V14" label="404 Lands" />
      </Link>
      {share && (
        <button type="button" aria-haspopup="dialog" onClick={() => setSharing(true)} className={IDLE}>
          <Item icon="M8 10V1.5M5 4.5 8 1.5l3 3M3 7.5v7h10v-7" label="Share" />
        </button>
      )}
      {share && sharing && <ShareDialog bunker={share.bunker} forks={share.forks} close={() => setSharing(false)} />}
    </nav>
  );
}
