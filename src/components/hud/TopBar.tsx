import Image from "next/image";

import { AudioToggle } from "@/components/audio/AudioToggle";
import { SyncButton } from "@/components/auth/SyncButton";
import { cacheCap, payloadCap, RATES, ratesPerHour, type ResourceState, type Workforce } from "@/lib/economy/tick";

import { AccountMenu } from "./AccountMenu";
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

/** The 56 px status bar: who and where on the left, the gauges and forecast, then Bytes, sound, sync and account. */
export function TopBar({ login, bytes, resources, work, lastSyncedAt, alerting = false }: Props) {
  const rates = ratesPerHour(work, resources.uptime > 0);
  return (
    <header
      data-topbar
      data-hud
      className="pointer-events-auto absolute inset-x-0 top-0 z-30 flex h-14 items-center gap-4 border-b border-hud-violet/40 bg-hud-bg/95 px-4 font-mono"
    >
      <div className="flex shrink-0 items-center gap-3">
        <Image src="/brand/mascot-pixel.png" alt="" width={28} height={28} unoptimized className="pixel h-7 w-7" />
        <span className="hidden font-pixel text-sm tracking-[0.12em] text-hud-violet sm:inline">GIT SHELTERS</span>
        <span aria-hidden className="hidden h-8 w-px bg-hud-violet-dim lg:block" />
        <div className="hidden leading-tight lg:block">
          <p className="text-sm text-hud-bone">{login ?? "Maintainer"}</p>
          <p className="text-[9px] uppercase tracking-[0.22em] text-hud-bone/60">Repo · The Outage</p>
        </div>
      </div>

      <div className="no-scrollbar flex min-w-0 flex-1 justify-center gap-6 overflow-x-auto">
        <ResourceGauge kind="cache" value={resources.cache} cap={cacheCap(work.cacheStorages)} ratePerHour={rates.cache} />
        <ResourceGauge kind="uptime" value={resources.uptime} cap={RATES.uptimeCap} ratePerHour={rates.uptime} />
        {work.workshops > 0 && (
          <ResourceGauge kind="payload" value={resources.payload} cap={payloadCap(work.workshops)} ratePerHour={rates.payload} />
        )}
      </div>
      {/* Outside the scrolling gauge row, so the drawer is not clipped. */}
      <ForecastDrawer resources={resources} work={work} alerting={alerting} />

      <div className="flex shrink-0 items-center gap-2">
        <AudioToggle variant="icon" />
        {bytes !== null && (
          <div className="flex h-9 items-center gap-2 border border-hud-violet/40 px-3" title="Bytes">
            <span className="text-[9px] uppercase tracking-[0.22em] text-hud-bone/60">Bytes</span>
            <span className="font-pixel text-[17px] tabular-nums text-hud-bone">{bytes.toLocaleString("en-US")}</span>
            <span className="text-xs text-hud-violet">B</span>
          </div>
        )}
        <SyncButton lastSyncedAt={lastSyncedAt} />
        <AccountMenu login={login} alerting={alerting} />
      </div>
    </header>
  );
}
