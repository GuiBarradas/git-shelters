import { resolveDailyEvent } from "@/app/events/actions";
import type { DailyEventView } from "@/lib/events/daily";

export type { DailyEventView };

/**
 * Bottom-left panel with today's Daily Event. Two forms post the choice to
 * the resolveDailyEvent Server Action; once resolved, the same panel shows
 * the outcome until the next UTC day.
 */
export function DailyEventCard({
  event,
  variant = "panel",
}: {
  event: DailyEventView;
  /** "screen" fills the Main Branch terminal; "panel" floats over the page. */
  variant?: "panel" | "screen";
}) {
  const frame =
    variant === "screen"
      ? "pointer-events-auto h-full w-full overflow-y-auto bg-[#041a08] px-3 py-2 font-mono text-[11px] leading-snug text-[#9BFF8A] [text-shadow:0_0_6px_rgba(127,255,106,0.6)] [&_h2]:mb-1 [&_p]:mb-2 [&_button]:py-1"
      : "pointer-events-auto max-w-sm border border-[#7FFF6A] bg-[#0F0F0F]/90 p-4 font-mono text-sm text-[#E6DFC8]";
  return (
    <aside className={frame}>
      <h2 className="mb-2 text-[#7FFF6A]">{event.title}</h2>
      <p className="mb-4 leading-relaxed">{event.narrative}</p>

      {event.resolved ? (
        <div className="space-y-2">
          <p className="text-[#7FFF6A]/70">
            &gt; {event.options[event.resolved.choice].label}
          </p>
          <p className="leading-relaxed">{event.resolved.outcome.outcome_text}</p>
          <p className="text-[#7FFF6A]">
            {formatDelta(event.resolved.outcome.bytes_delta)}
            <span className="text-[#E6DFC8]/50"> · next packet at 00:00 UTC</span>
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {(["a", "b"] as const).map((choice) => (
            <form key={choice} action={resolveDailyEvent}>
              <input type="hidden" name="choice" value={choice} />
              <button
                type="submit"
                className="w-full border border-[#7FFF6A] px-3 py-2 text-left text-[#7FFF6A] transition hover:bg-[#7FFF6A]/10"
              >
                {event.options[choice].label}
              </button>
            </form>
          ))}
        </div>
      )}
    </aside>
  );
}

function formatDelta(delta: number): string {
  return `${delta >= 0 ? "+" : ""}${delta} B`;
}
