"use client";

import { useId } from "react";

import { forecast, FORECAST_HOURS } from "@/lib/economy/forecast";
import { RATES, type ResourceState, type Workforce } from "@/lib/economy/tick";

import { FORECAST_WARNINGS as WARNINGS } from "./forecastCopy";
import { useDisclosure } from "./useDisclosure";

const delta = (value: number) => (value > 0 ? `+${value}` : value < 0 ? `−${-value}` : "±0");

/**
 * The FORECAST button and the drawer under it: the same simulation the
 * catch-up runs, pointed {@link FORECAST_HOURS} hours ahead. `alerting`
 * drops the drawer below the AlertBanner so it never covers the fix.
 */
export function ForecastDrawer({ resources, work, alerting = false }: {
  resources: ResourceState;
  work: Workforce;
  alerting?: boolean;
}) {
  const { open, setOpen, root, trigger } = useDisclosure();
  const id = useId();
  const future = forecast(resources, work);
  const rows = [
    { label: "Cache", now: resources.cache, then: future.cache, change: future.delta.cache, unit: "" },
    { label: "Uptime", now: resources.uptime, then: future.uptime, change: future.delta.uptime, unit: "%" },
    ...(work.workshops > 0
      ? [{ label: "Payload", now: resources.payload, then: future.payload, change: future.delta.payload, unit: "" }]
      : []),
  ];

  return (
    <div ref={root} className="relative shrink-0">
      <button
        ref={trigger}
        type="button"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((v) => !v)}
        className={`flex h-9 items-center gap-2 border px-4 text-[10px] uppercase tracking-[0.22em] text-hud-violet hover:bg-hud-violet/10 ${open ? "border-hud-violet" : "border-hud-violet/40"}`}
      >
        Forecast
        <svg aria-hidden viewBox="0 0 10 10" className={`h-2.5 w-2.5 fill-none stroke-current ${open ? "rotate-180" : ""}`} strokeWidth={1.4}>
          <path d="M2 3.5 5 6.5 8 3.5" />
        </svg>
      </button>
      {open && (
        <div
          id={id}
          role="region"
          aria-label={`Forecast: if you return in ${FORECAST_HOURS} hours`}
          className={`absolute right-0 top-full z-30 w-[360px] max-w-[calc(100vw-2rem)] border border-hud-violet bg-hud-bg/95 p-4 text-xs text-hud-bone ${alerting ? "mt-[52px]" : "mt-2"}`}
        >
          <div className="mb-3 flex items-baseline justify-between">
            <h2 className="text-[10px] uppercase tracking-[0.22em] text-hud-violet">If you return in {FORECAST_HOURS} hours</h2>
            <span className="text-[10px] text-hud-bone/60">estimate</span>
          </div>
          <table className="w-full tabular-nums">
            <tbody>
              {rows.map((row) => (
                <tr key={row.label}>
                  <th scope="row" className="py-1 text-left font-normal text-hud-bone/70">{row.label}</th>
                  <td className="py-1">
                    {row.now}{row.unit} → <span className={row.then === 0 && row.label !== "Payload" ? "text-hud-red-text" : ""}>{row.then}{row.unit}</span>
                  </td>
                  <td className={`py-1 text-right ${row.change < 0 ? "text-hud-red-text" : "text-hud-bone/60"}`}>{delta(row.change)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="mt-3 space-y-2 border-t border-hud-violet/40 pt-3 leading-relaxed">
            {future.blackout && (
              <p className="text-hud-red-text">
                &gt; {resources.uptime === 0 ? "The lights stay out. Cooking and packing stay stopped." : "Power will be depleted. Cooking and packing stop without power."}
              </p>
            )}
            {future.starved && <p className="text-hud-red-text">&gt; The crew will run out of food in this window.</p>}
            {future.warnings.map((w) => (
              <p key={w} className={WARNINGS[w].tone}>&gt; {WARNINGS[w].text}</p>
            ))}
            <p className="text-hud-bone/60">
              Estimate from this visit, with current jobs and storage limits. Resources settle when you return, up to{" "}
              {RATES.maxHours / 24} days away. Rooms produce resources, not Bytes. Moving workers is free.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
