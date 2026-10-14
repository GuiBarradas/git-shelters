"use client";

import Link from "next/link";
import type { RefObject } from "react";

import { GameDock } from "@/components/hud/GameDock";
import { setQuality, type Quality } from "@/components/scene/quality";
import type { MapPin } from "@/lib/api/world-map";
import { REGIONS, type Region } from "@/lib/regions/catalog";

import { activityLabel, type MapBunker } from "./scene/bunker";

const PANEL = "border border-hud-violet/40 bg-hud-bg/95";
const CONTROL = `pointer-events-auto ${PANEL} px-2.5 py-1.5 text-hud-bone hover:bg-hud-violet/10`;

const answering = (n: number) => `${n} ${n === 1 ? "Repo" : "Repos"} answering`;

/** Title block shared by the 3D overlay and the SVG fallback. */
export function MapTitle({ review, count }: { review: boolean; count: number }) {
  return (
    <div>
      <h1 className="font-pixel text-lg tracking-[0.12em] text-hud-violet">THE 404 LANDS</h1>
      <p className="hidden max-w-md text-xs text-hud-bone/60 sm:block">Every Repo that still answers. One region has signal; the rest is static, for now.</p>
      {review && (
        <p className="mt-1 inline-block border border-hud-amber px-2 py-0.5 text-[10px] uppercase tracking-[0.22em] text-hud-amber">
          Synthetic review data · {count} fake Repos, not players
        </p>
      )}
    </div>
  );
}

/** Every Repo as a keyboard-reachable link: the canvas itself is not read by screen readers. */
export function RepoList({ pins, mine, review }: { pins: MapPin[]; mine: MapPin | null; review: boolean }) {
  return (
    <details className={`pointer-events-auto ${PANEL} text-xs`}>
      <summary className="px-3 py-2 uppercase tracking-[0.22em] text-hud-violet">Repos ({pins.length})</summary>
      <ul className="max-h-48 overflow-y-auto px-3 pb-2">
        {pins.map((p) => {
          const label = `${p.login}${p === mine ? " (you)" : ""} · ${p.bytes.toLocaleString("en-US")} B`;
          return (
            <li key={p.login} className="py-0.5">
              {/* Synthetic logins have no profile to open. */}
              {review ? <span className="text-hud-bone/70">{label}</span> : (
                <Link href={`/u/${p.login}`} prefetch={false} className="text-hud-bone/80 hover:text-hud-bone">{label}</Link>
              )}
            </li>
          );
        })}
      </ul>
    </details>
  );
}

/** Bunker card: real pin facts only; the activity line is left out when it is unknown. */
function BunkerTip({ tip, pinned, review, onClose }: { tip: MapBunker; pinned: boolean; review: boolean; onClose: () => void }) {
  const { pin, mine } = tip;
  const activity = activityLabel(pin.activity);
  return (
    <div className={`${pinned ? "pointer-events-auto" : ""} ${PANEL} min-w-48 px-3 py-2 text-xs`}>
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-hud-bone">{pin.login}</span>
        {mine && <span className="text-[10px] uppercase tracking-[0.22em] text-hud-amber">Your Repo</span>}
        {pinned && <button type="button" onClick={onClose} aria-label="Close" className="px-1 text-hud-bone/70 hover:text-hud-bone">×</button>}
      </div>
      {activity && <p className="text-hud-bone/70">{activity}</p>}
      <p className="text-hud-bone/70">
        {pin.bytes.toLocaleString("en-US")} B · {pin.rooms} {pin.rooms === 1 ? "room" : "rooms"} · {pin.badges} {pin.badges === 1 ? "badge" : "badges"}
      </p>
      {review ? <p className="mt-1 text-hud-bone/50">synthetic · no profile</p> : !pinned ? (
        // A hover card follows the pointer and can't be reached; the click on the bunker opens the profile.
        <p className="mt-1 text-hud-violet">click to open profile</p>
      ) : (
        <Link href={`/u/${pin.login}`} prefetch={false} className="mt-1 inline-block text-hud-violet hover:text-hud-bone">open profile →</Link>
      )}
    </div>
  );
}

/**
 * The DOM layer over the 3D map, on the HUD v2 tokens: title and view
 * controls on top, region labels placed every frame by LabelProjector
 * through {@link labels}, and the region panel, Repo list and dock below.
 */
export function MapOverlay({
  pins, mine, tip, pinned, tipEl, youEl, onCloseTip, review, labels, selected, onClose, fog, onFog, drift, onDrift, quality, reducedMotion, onReset, onFindMe,
}: {
  pins: MapPin[];
  mine: MapPin | null;
  /** The bunker under the pointer, or pinned by a tap. */
  tip: MapBunker | null;
  pinned: boolean;
  /** Placed over the tip bunker and the visitor's own bunker by ScreenAnchor. */
  tipEl: RefObject<HTMLDivElement | null>;
  youEl: RefObject<HTMLDivElement | null>;
  onCloseTip: () => void;
  review: boolean;
  labels: RefObject<Map<string, HTMLElement>>;
  selected: Region | null;
  onClose: () => void;
  fog: boolean;
  onFog: (on: boolean) => void;
  /** null when drift is unavailable (reduced motion). */
  drift: boolean | null;
  onDrift: (on: boolean) => void;
  quality: Quality;
  reducedMotion: boolean;
  onReset: () => void;
  onFindMe: () => void;
}) {
  const count = (id: string) => pins.filter((p) => p.region === id).length;
  // Credited today: a backfill counts too, so it says "active", not "pushed".
  const activeToday = (id: string) => pins.filter((p) => p.region === id && p.activity === 1).length;
  // With nothing picked the panel reads the open region, where every Repo lives.
  const region = selected ?? REGIONS.find((r) => r.open)!;
  return (
    <div data-hud className="pointer-events-none absolute inset-0 font-mono text-hud-bone">
      <div className="absolute inset-0 overflow-hidden">
        {REGIONS.map((r) => (
          <div
            key={r.id}
            ref={(el) => {
              if (el) labels.current.set(r.id, el);
              else labels.current.delete(r.id);
            }}
            style={{ visibility: "hidden" }}
            className="absolute left-0 top-0 whitespace-nowrap text-center text-[10px] uppercase tracking-[0.22em]"
          >
            <p className={r.open ? "text-hud-violet" : "text-hud-violet/70"}>{r.name}</p>
            {r.open
              ? <p className="text-hud-bone/80">{answering(count(r.id))}</p>
              : <p className={`text-hud-violet/60 ${reducedMotion ? "" : "blink"}`}>No signal</p>}
          </div>
        ))}
        {mine && (
          <div ref={youEl} style={{ visibility: "hidden" }} className="absolute left-0 top-0">
            <p className="-translate-x-1/2 -translate-y-full whitespace-nowrap text-[10px] uppercase tracking-[0.22em] text-hud-amber">You · {mine.login}</p>
          </div>
        )}
        <div ref={tipEl} style={{ visibility: "hidden" }} className="absolute left-0 top-0">
          {/* Up and right of the hatch, clear of the pointer. */}
          {tip && <div className="translate-x-4 -translate-y-[calc(100%+14px)]"><BunkerTip tip={tip} pinned={pinned} review={review} onClose={onCloseTip} /></div>}
        </div>
      </div>

      <header className="absolute inset-x-0 top-0 flex flex-col gap-2 p-3 sm:flex-row sm:items-start sm:justify-between sm:p-4">
        <MapTitle review={review} count={pins.length} />
        <div role="toolbar" aria-label="Map view" className="flex flex-wrap items-center gap-2 text-[10px] uppercase tracking-[0.22em]">
          <button type="button" onClick={onReset} className={CONTROL} aria-keyshortcuts="R">Reset view</button>
          {mine && (
            <button type="button" onClick={onFindMe} aria-keyshortcuts="F" className="pointer-events-auto bg-hud-amber px-2.5 py-1.5 text-hud-bg hover:bg-hud-amber/85">
              Find my Repo
            </button>
          )}
          <label className={`${CONTROL} flex items-center gap-2`}>
            <span className="hidden sm:inline">Visual</span>
            <select aria-label="Visual quality" value={quality} onChange={(e) => setQuality(e.target.value as Quality)} className="bg-hud-bg text-hud-bone">
              <option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option>
            </select>
          </label>
        </div>
      </header>

      {/* Phones stack the panels over a full-width dock; wide screens put region left, dock centre, controls right, above the site footer. */}
      <div className="absolute inset-x-0 bottom-0 flex flex-col gap-2 sm:pb-7 lg:flex-row lg:items-end lg:justify-between lg:px-3">
        <section aria-label="Region" aria-live="polite" className={`pointer-events-auto mx-3 ${PANEL} px-3 py-2 text-xs sm:mx-auto sm:w-96 lg:mx-0`}>
          <div className="flex items-start justify-between gap-2 uppercase tracking-[0.22em]">
            <h2 className="text-hud-violet">{region.name}</h2>
            <span className={region.open ? "text-hud-amber" : "text-hud-violet/60"}>{region.open ? "Signal" : "No signal"}</span>
            {selected && <button type="button" onClick={onClose} aria-label="Close region" className="px-1 text-hud-bone/70 hover:text-hud-bone">×</button>}
          </div>
          <p className="mt-1 text-hud-bone/80">{region.blurb}</p>
          <p className="mt-1 text-hud-bone/60">
            {region.open ? `${answering(count(region.id))} · ${activeToday(region.id)} active today` : "Locked in the alpha"}
          </p>
        </section>
        <div className="order-last sm:mx-auto lg:order-none lg:mx-0"><GameDock active="map" /></div>
        <div className={`pointer-events-auto mx-3 ${PANEL} px-3 py-2 text-xs sm:mx-auto sm:w-96 lg:mx-0 lg:w-80`}>
          <ul className="mb-2 hidden space-y-1 text-hud-bone/80 sm:block">
            <li className="flex items-center gap-2"><span className="size-2.5 bg-hud-amber" />your Repo</li>
            <li className="flex items-center gap-2"><span className="size-2.5 bg-hud-lamp" />a Repo · brighter = more recent activity</li>
            <li className="flex items-center gap-2"><span className="size-2.5 rounded-full bg-hud-violet" />a Repo with no synced activity yet</li>
            <li className="flex items-center gap-2"><span className="size-2.5 bg-hud-beacon" />Outage emergency beacon</li>
            <li className="flex items-center gap-2"><span className="size-2.5 border border-hud-violet/60 bg-hud-violet/25" />no signal · hover to peek</li>
          </ul>
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={fog} onChange={(e) => onFog(e.target.checked)} className="accent-hud-violet" />
              Signal fog
            </label>
            {drift !== null && (
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={drift} onChange={(e) => onDrift(e.target.checked)} className="accent-hud-violet" />
                Drift
              </label>
            )}
          </div>
          <p className="mt-1 hidden text-[10px] text-hud-bone/50 sm:block">drag to pan · right-drag to orbit · wheel to zoom</p>
          <p className="mt-1 text-[10px] text-hud-bone/50 sm:hidden">drag to pan · pinch to zoom</p>
          <div className="mt-2"><RepoList pins={pins} mine={mine} review={review} /></div>
        </div>
      </div>
    </div>
  );
}
