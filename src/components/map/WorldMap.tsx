"use client";

import { useState } from "react";

import type { MapPin } from "@/lib/api/world-map";
import { MAP_HEIGHT, MAP_WIDTH, REGIONS, type Region } from "@/lib/regions/catalog";

/**
 * The 404 Lands as one SVG: seven regions, one open, and a dot per
 * bunker. Hovering a region reads its blurb; hovering a dot reads the
 * bunker's public facts; clicking a dot opens the profile. No WebGL:
 * the map is a chart, and a chart should be crisp and cheap.
 */
export function WorldMap({ pins, me }: { pins: MapPin[]; me: string | null }) {
  const [region, setRegion] = useState<Region | null>(null);
  const [pin, setPin] = useState<MapPin | null>(null);

  const open = REGIONS.filter((r) => r.open).length;

  return (
    <div className="relative mx-auto w-full max-w-5xl">
      <svg viewBox={`0 0 ${MAP_WIDTH} ${MAP_HEIGHT}`} className="block h-auto w-full" role="img" aria-label="Map of the 404 Lands">
        <defs>
          <pattern id="grid" width="50" height="50" patternUnits="userSpaceOnUse">
            <path d="M 50 0 L 0 0 0 50" fill="none" stroke="#BD93F9" strokeOpacity="0.07" strokeWidth="1" />
          </pattern>
          <pattern id="static" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <line x1="0" y1="0" x2="0" y2="8" stroke="#8D46A3" strokeOpacity="0.35" strokeWidth="1" />
          </pattern>
        </defs>
        <rect width={MAP_WIDTH} height={MAP_HEIGHT} fill="#0B0713" />
        <rect width={MAP_WIDTH} height={MAP_HEIGHT} fill="url(#grid)" />

        {REGIONS.map((r) => {
          const hot = region?.id === r.id;
          return (
            <g
              key={r.id}
              onMouseEnter={() => setRegion(r)}
              onMouseLeave={() => setRegion(null)}
              className={r.open ? "cursor-default" : "cursor-not-allowed"}
            >
              <polygon
                points={r.shape.map((p) => p.join(",")).join(" ")}
                fill={r.open ? "#2D2235" : "url(#static)"}
                fillOpacity={r.open ? (hot ? 1 : 0.85) : 1}
                stroke={r.open ? "#BD93F9" : "#8D46A3"}
                strokeOpacity={hot ? 1 : 0.7}
                strokeWidth={hot ? 2 : 1.2}
                strokeDasharray={r.open ? undefined : "6 5"}
              />
              <text
                x={r.label[0]}
                y={r.label[1]}
                textAnchor="middle"
                className="font-mono"
                fontSize="15"
                letterSpacing="3"
                fill={r.open ? "#BD93F9" : "#8D46A3"}
              >
                {r.name.toUpperCase()}
              </text>
              {!r.open && (
                <text x={r.label[0]} y={r.label[1] + 20} textAnchor="middle" className="font-mono" fontSize="10" letterSpacing="2" fill="#8D46A3" fillOpacity="0.8">
                  NO SIGNAL
                </text>
              )}
            </g>
          );
        })}

        {pins.map((p) => {
          const mine = me !== null && p.login.toLowerCase() === me.toLowerCase();
          const hot = pin?.login === p.login;
          // A plain SVG anchor: next/link does not drive navigation from inside an <svg>.
          return (
            <a key={p.login} href={`/u/${p.login}`} aria-label={`${p.login}'s Repo`}>
              <g
                onMouseEnter={() => setPin(p)}
                onMouseLeave={() => setPin(null)}
                onFocus={() => setPin(p)}
                onBlur={() => setPin(null)}
                className="cursor-pointer"
              >
                {mine && (
                  <circle cx={p.at[0]} cy={p.at[1]} r="9" fill="none" stroke="#E67E22" strokeWidth="1.5">
                    <animate attributeName="r" values="6;13;6" dur="2.4s" repeatCount="indefinite" />
                    <animate attributeName="stroke-opacity" values="0.9;0;0.9" dur="2.4s" repeatCount="indefinite" />
                  </circle>
                )}
                {/* a generous invisible target; the visible dot stays small */}
                <circle cx={p.at[0]} cy={p.at[1]} r="12" fill="transparent" />
                <circle cx={p.at[0]} cy={p.at[1]} r={hot || mine ? 5 : 3.5} fill={mine ? "#E67E22" : "#BD93F9"} stroke="#0B0713" strokeWidth="1.5" />
              </g>
            </a>
          );
        })}
      </svg>

      {/* read-out: the hovered bunker beats the hovered region */}
      <div className="pointer-events-none absolute right-3 bottom-3 max-w-xs border border-[#BD93F9]/40 bg-[#0B0713]/95 px-3 py-2 font-mono text-xs text-[#E6DFC8]">
        {pin ? (
          <>
            <p className="text-[#E67E22]">{pin.login}&apos;s Repo</p>
            <p className="text-[#E6DFC8]/70">
              {pin.bytes.toLocaleString("en-US")} B · {pin.rooms} {pin.rooms === 1 ? "room" : "rooms"} · {pin.badges}{" "}
              {pin.badges === 1 ? "badge" : "badges"}
            </p>
            <p className="text-[#E6DFC8]/50">settled {pin.memberSince.slice(0, 10)} · click to visit</p>
          </>
        ) : region ? (
          <>
            <p className="text-[#BD93F9]">
              {region.name} {region.open ? "" : "· no signal"}
            </p>
            <p className="text-[#E6DFC8]/70">{region.blurb}</p>
          </>
        ) : (
          <>
            <p className="text-[#BD93F9]">The 404 Lands</p>
            <p className="text-[#E6DFC8]/70">
              {pins.length} {pins.length === 1 ? "bunker" : "bunkers"} in {open} of {REGIONS.length} regions. Hover a dot.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
