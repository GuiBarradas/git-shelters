import { resolveDailyEvent } from "@/app/events/actions";
import type { DailyEventOption } from "@/lib/events/option";

export type DailyEventView = {
  title: string;
  narrative: string;
  options: { a: DailyEventOption; b: DailyEventOption };
  /** Today's resolution, if the player already decided. */
  resolved: { choice: "a" | "b"; outcome: DailyEventOption } | null;
};

/**
 * Bottom-left panel with today's Daily Event. Two forms post the choice to
 * the resolveDailyEvent Server Action; once resolved, the same panel shows
 * the outcome until the next UTC day.
 */
export function DailyEventCard({ event }: { event: DailyEventView }) {
  return (
    <aside className="pointer-events-auto max-w-sm border border-[#7FFF6A] bg-[#0F0F0F]/90 p-4 font-mono text-sm text-[#E6DFC8]">
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
