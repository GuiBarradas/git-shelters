"use client";

import { clampPage, PAGES } from "@/components/scene/pager";

// aria-disabled, not disabled: a focused arrow stays focused at either end.
const BTN = "flex h-11 items-center justify-center text-hud-violet aria-disabled:text-hud-plum";

function Chevron({ d }: { d: string }) {
  return (
    <svg aria-hidden viewBox="0 0 10 10" className="h-3 w-3 fill-none stroke-current" strokeWidth={1.4}>
      <path d={d} />
    </svg>
  );
}

/**
 * Phone overview: which pair of columns the camera frames. A swipe on the
 * scene pages too; this is the visible state and the keyboard path
 * (buttons, or the arrow keys anywhere inside).
 */
export function RoomPager({ page, onPage }: { page: number; onPage: (page: number) => void }) {
  const go = (next: number) => onPage(clampPage(next));
  const last = PAGES.length - 1;
  return (
    <div
      role="group"
      aria-label="Bunker columns"
      onKeyDown={(e) => {
        if (e.key === "ArrowLeft") go(page - 1);
        else if (e.key === "ArrowRight") go(page + 1);
        else return;
        e.preventDefault();
      }}
      className="pointer-events-auto flex items-center justify-center gap-1 px-4 font-mono text-[10px] text-hud-bone/60 sm:hidden"
    >
      <button type="button" aria-label="Previous rooms" aria-disabled={page === 0} onClick={() => go(page - 1)} className={`${BTN} w-11`}>
        <Chevron d="M6.5 2 3.5 5l3 3" />
      </button>
      {PAGES.map((cols, i) => (
        <button
          key={cols.join()}
          type="button"
          aria-label={`Rooms ${i + 1} of ${PAGES.length}`}
          aria-current={i === page || undefined}
          onClick={() => go(i)}
          className={`${BTN} w-7`}
        >
          <span aria-hidden className={`h-1 ${i === page ? "w-6 bg-hud-violet" : "w-3 bg-hud-plum"}`} />
        </button>
      ))}
      <button type="button" aria-label="Next rooms" aria-disabled={page === last} onClick={() => go(page + 1)} className={`${BTN} w-11`}>
        <Chevron d="M3.5 2l3 3-3 3" />
      </button>
      <span aria-hidden className="ml-2">swipe for more rooms</span>
    </div>
  );
}
