/**
 * "Achievement unlocked" (design doc §22, notification toast): one line
 * per badge earned on this visit, top right under the auth bar, gone on
 * its own via the hud-fade animation. Server component: nothing to
 * click, nothing to remember.
 */
export function BadgeToast({ badges }: { badges: Array<{ name: string; blurb: string; kind: string }> }) {
  if (badges.length === 0) return null;
  return (
    <ul className="pointer-events-none absolute top-16 right-4 z-30 w-72 space-y-2 font-mono text-xs">
      {badges.map((b, i) => (
        <li
          key={b.name}
          className="hud-fade border border-[#BD93F9]/60 bg-[#0B0713]/95 px-3 py-2 text-[#E6DFC8]"
          style={{ animationDuration: `${6 + i * 2}s` }}
        >
          <p className="text-[10px] uppercase tracking-[0.25em] text-[#BD93F9]/70">
            {b.kind === "achievement" ? "achievement unlocked" : "badge earned"}
          </p>
          <p className="text-[#BD93F9]">{b.name}</p>
          <p className="text-[#E6DFC8]/60">{b.blurb}</p>
        </li>
      ))}
    </ul>
  );
}
