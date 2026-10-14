import Image from "next/image";

import { AudioToggle } from "@/components/audio/AudioToggle";
import { SyncButton } from "@/components/auth/SyncButton";
import { cacheCap, payloadCap, RATES, ratesPerHour, type ResourceState, type Workforce } from "@/lib/economy/tick";

import { AccountMenu } from "./AccountMenu";
import { BarOrder } from "./BarOrder";
import { ForecastDrawer } from "./ForecastDrawer";
import { ResourceGauge } from "./ResourceGauge";

type Props = {
  login: string | null;
  /** users.bytes; null when unavailable, and the Bytes box is left out. */
  bytes: number | null;
  resources: ResourceState;
  work: Workforce;
  /** github_sync_state.last_synced_at; null hides the elapsed label. */
  lastSyncedAt: string | null;
  /** An AlertBanner sits under the bar; pop-outs open below it. */
  alerting?: boolean;
};

/**
 * The status bar: who and where, the gauges and forecast, then Bytes,
 * sound, sync and account. One 56 px row from `lg` (compact until `xl`);
 * below that a 52 px row and a 56 px resource strip, 108 px in all
 * (hudTop): mascot and Bytes left, sync and account right, then the
 * strip. On phones sound moves into the AccountMenu. DOM order follows
 * the rows at each breakpoint (BarOrder), so Tab reads left to right, top
 * to bottom; the CSS `order` only covers the first paint before hydration.
 */
export function TopBar({ login, bytes, resources, work, lastSyncedAt, alerting = false }: Props) {
  const rates = ratesPerHour(work, resources.uptime > 0);
  const items = {
    brand: (
      <div className="flex h-[52px] shrink-0 items-center gap-3 pl-4 lg:h-auto lg:pl-0">
        <Image src="/brand/mascot-pixel.png" alt="" width={28} height={28} unoptimized className="pixel h-7 w-7" />
        <span className="hidden font-pixel text-sm tracking-[0.12em] text-hud-violet sm:inline lg:hidden xl:inline">GIT SHELTERS</span>
        <span aria-hidden className="hidden h-8 w-px bg-hud-violet-dim xl:block" />
        <div className="hidden leading-tight xl:block">
          <p className="text-sm text-hud-bone">{login ?? "Maintainer"}</p>
          <p className="text-[9px] uppercase tracking-[0.22em] text-hud-bone/60">Repo · The Outage</p>
        </div>
      </div>
    ),
    // Below lg its own row, and the whole strip opens the forecast.
    strip: (
      <div className="relative order-last flex h-14 basis-full items-center border-y border-hud-violet/40 px-4 lg:order-none lg:mx-2 lg:h-auto lg:min-w-0 lg:flex-1 lg:basis-auto lg:gap-4 lg:border-0 lg:px-0">
        <div className="no-scrollbar flex min-w-0 flex-1 justify-center gap-3 lg:gap-4 lg:overflow-x-auto xl:gap-6">
          <ResourceGauge kind="cache" value={resources.cache} cap={cacheCap(work.cacheStorages)} ratePerHour={rates.cache} />
          <ResourceGauge kind="uptime" value={resources.uptime} cap={RATES.uptimeCap} ratePerHour={rates.uptime} />
          {work.workshops > 0 && (
            <ResourceGauge kind="payload" value={resources.payload} cap={payloadCap(work.workshops)} ratePerHour={rates.payload} />
          )}
        </div>
        {/* Outside the scrolling gauge row, so the drawer is not clipped. */}
        <ForecastDrawer resources={resources} work={work} alerting={alerting} />
      </div>
    ),
    audio: (
      <span className="hidden sm:contents">
        <AudioToggle variant="icon" />
      </span>
    ),
    bytes: bytes !== null && (
      <div className="flex h-11 shrink-0 items-center gap-2 border border-hud-violet/40 px-3 lg:h-9" title="Bytes">
        <span className="hidden text-[9px] uppercase tracking-[0.22em] text-hud-bone/60 sm:inline lg:hidden xl:inline">Bytes</span>
        <span className="font-pixel text-[17px] tabular-nums text-hud-bone">{bytes.toLocaleString("en-US")}</span>
        <span className="text-xs text-hud-violet">B</span>
      </div>
    ),
    // Pushes sync and account to the right of the first row below lg.
    spacer: <span aria-hidden className="flex-1 lg:hidden" />,
    controls: (
      <div className="flex h-[52px] shrink-0 items-center gap-2 pr-4 lg:h-auto lg:pr-0">
        <SyncButton lastSyncedAt={lastSyncedAt} alerting={alerting} />
        <AccountMenu login={login} alerting={alerting} />
      </div>
    ),
  };
  return (
    <header
      data-topbar
      data-hud
      className="pointer-events-auto absolute inset-x-0 top-0 z-30 flex flex-wrap items-center gap-x-2 bg-hud-bg/95 font-mono lg:h-14 lg:flex-nowrap lg:border-b lg:border-hud-violet/40 lg:px-4"
    >
      <BarOrder items={items} wide={WIDE} narrow={NARROW} />
    </header>
  );
}

const WIDE = ["brand", "strip", "audio", "bytes", "spacer", "controls"] as const;
const NARROW = ["brand", "bytes", "spacer", "audio", "controls", "strip"] as const;
