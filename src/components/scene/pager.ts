import { useSyncExternalStore } from "react";

/**
 * The phone overview shows two of the five columns at a time. The last
 * page overlaps the middle one rather than framing a lone room.
 */
export const PAGES: ReadonlyArray<readonly [number, number]> = [[0, 1], [2, 3], [3, 4]];

export const clampPage = (page: number) => Math.max(0, Math.min(PAGES.length - 1, Math.trunc(page) || 0));

/** A swipe moves one page: more than 40 px sideways and clearly more sideways than vertical. Left swipe = next page. */
export function swipeStep(dx: number, dy: number): -1 | 0 | 1 {
  if (Math.abs(dx) <= 40 || Math.abs(dx) <= 1.5 * Math.abs(dy)) return 0;
  return dx < 0 ? 1 : -1;
}

// The page outlives a walk into a room and back: sessionStorage, with a
// module copy for when storage is blocked. The server snapshot is page 0.
const KEY = "gs.overview-page";
const listeners = new Set<() => void>();
let current: number | null = null;

function readPage(): number {
  if (current === null) {
    try {
      current = clampPage(Number(sessionStorage.getItem(KEY)));
    } catch {
      current = 0;
    }
  }
  return current;
}

export function setPage(page: number) {
  current = clampPage(page);
  try {
    sessionStorage.setItem(KEY, String(current));
  } catch {
    // blocked storage: the module copy still holds it for this visit
  }
  for (const l of listeners) l();
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => { listeners.delete(cb); };
}

export function useOverviewPage(): number {
  return useSyncExternalStore(subscribe, readPage, () => 0);
}
