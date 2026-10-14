/**
 * "Achievement unlocked" (design doc §22, notification toast): one line
 * per badge earned on this visit, top right under the TopBar (and the
 * AlertBanner when one is up), gone on its own via the hud-fade
 * animation. Server component: nothing to click, nothing to remember.
 */
export function BadgeToast({ badges, alerting = false }: { badges: Array<{ name: string; blurb: string; kind: string }>; alerting?: boolean }) {
  if (badges.length === 0) return null;
  return (
    <ul className={`pointer-events-none absolute ${alerting ? "top-[160px] lg:top-[116px]" : "top-[116px] lg:top-[72px]"} right-4 z-30 w-72 max-w-[calc(100vw-2rem)] space-y-2 font-mono text-xs`}>
      {badges.map((b, i) => (
        <li
          key={b.name}
          className="hud-fade border border-hud-violet/60 bg-hud-bg/95 px-3 py-2 text-hud-bone"
          style={{ animationDuration: `${6 + i * 2}s` }}
        >
          <p className="text-[10px] uppercase tracking-[0.25em] text-hud-bone/70">
            {b.kind === "achievement" ? "achievement unlocked" : "badge earned"}
          </p>
          <p className="text-hud-violet">{b.name}</p>
          <p className="text-hud-bone/60">{b.blurb}</p>
        </li>
      ))}
    </ul>
  );
}
