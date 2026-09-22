import { resolveDailyEvent } from "@/app/events/actions";
import type { DailyEventView } from "@/lib/events/daily";

export type { DailyEventView };

/**
 * Today's Daily Event. Two forms post the choice to the resolveDailyEvent
 * Server Action; once resolved, the same surface shows the outcome until
 * the next UTC day.
 *
 * "panel" floats over the page; "screen" is the Main Branch terminal:
 * phosphor text on a CRT (scanlines, vignette, glow from globals.css),
 * options rendered as terminal lines, no visible scrollbar.
 */
export function DailyEventCard({
  event,
  variant = "panel",
}: {
  event: DailyEventView;
  variant?: "panel" | "screen";
}) {
  if (variant === "screen") return <TerminalScreen event={event} />;

  return (
    <aside className="pointer-events-auto max-w-sm border border-[#7FFF6A] bg-[#0F0F0F]/90 p-4 font-mono text-sm text-[#E6DFC8]">
      <h2 className="mb-2 text-[#7FFF6A]">{event.title}</h2>
      <p className="mb-4 leading-relaxed">{event.narrative}</p>
      {event.resolved ? (
        <div className="space-y-2">
          <p className="text-[#7FFF6A]/70">&gt; {event.options[event.resolved.choice].label}</p>
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

function TerminalScreen({ event }: { event: DailyEventView }) {
  return (
    <aside className="crt no-scrollbar pointer-events-auto h-full w-full overflow-y-auto px-3 pb-2 pt-1.5 font-mono text-[9.5px] leading-[1.35] text-[#9BFF8A]">
      <p className="mb-1 flex justify-between text-[8px] uppercase tracking-[0.2em] text-[#7FFF6A]/45">
        <span>main-branch:~$ cat packet.log</span>
        <span>{event.resolved ? "resolved" : "pending"}</span>
      </p>
      <h2 className="mb-1 font-bold text-[#C8FFB8]">{event.title}</h2>
      <p className="mb-1.5">{event.narrative}</p>

      {event.resolved ? (
        <div className="space-y-1">
          <p className="text-[#7FFF6A]/70">&gt; {event.options[event.resolved.choice].label}</p>
          <p>{event.resolved.outcome.outcome_text}</p>
          <p className="text-[#C8FFB8]">
            {formatDelta(event.resolved.outcome.bytes_delta)}
            <span className="text-[#7FFF6A]/45"> · next packet 00:00 UTC</span>
          </p>
          <p className="text-[#7FFF6A]/70">
            main-branch:~$ <span className="blink">_</span>
          </p>
        </div>
      ) : (
        <div className="space-y-0.5">
          <p className="text-[#7FFF6A]/60">select an option:</p>
          {(["a", "b"] as const).map((choice) => (
            <form key={choice} action={resolveDailyEvent}>
              <input type="hidden" name="choice" value={choice} />
              <button
                type="submit"
                className="block w-full px-1 text-left text-[#9BFF8A] transition hover:bg-[#7FFF6A]/20 hover:text-[#0F0F0F] focus-visible:bg-[#7FFF6A]/20"
              >
                <span className="text-[#7FFF6A]/60">[{choice.toUpperCase()}]</span> {event.options[choice].label}
              </button>
            </form>
          ))}
          <p className="text-[#7FFF6A]/70">
            main-branch:~$ <span className="blink">_</span>
          </p>
        </div>
      )}
    </aside>
  );
}

function formatDelta(delta: number): string {
  return `${delta >= 0 ? "+" : ""}${delta} B`;
}
