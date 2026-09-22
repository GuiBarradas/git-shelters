import { assignFork } from "@/app/forks/actions";
import { FORK_TRAITS, type Fork } from "@/lib/forks/catalog";
import { jobFor } from "@/lib/forks/jobs";
import { MOOD_LABEL } from "@/lib/forks/mood";
import { ROOM_CATALOG, type Room } from "@/lib/rooms/catalog";

/**
 * The crew roster for a room page: who is here, who could be, and one
 * form per survivor to move them. Server component; each button posts to
 * the assignFork Server Action.
 */
export function CrewPanel({
  forks,
  rooms,
  slot,
}: {
  forks: Fork[];
  rooms: Room[];
  /** The room being viewed: 0 = Main Branch. */
  slot: number;
}) {
  const kindOf = (s: number | null) => (s === null || s === 0 ? null : (rooms.find((r) => r.slot === s)?.kind ?? null));
  const here = forks.filter((f) => (f.roomSlot ?? 0) === slot);
  const elsewhere = forks.filter((f) => (f.roomSlot ?? 0) !== slot);
  const roomName = slot === 0 ? "Main Branch" : (ROOM_CATALOG[kindOf(slot)!]?.name ?? "this room");

  return (
    <section className="pointer-events-auto mt-4 max-w-xs space-y-3 font-mono text-xs">
      <div>
        <p className="mb-1 text-[#E6DFC8]/50">on shift here</p>
        {here.length === 0 ? (
          <p className="text-[#E6DFC8]/40">nobody. {slot === 0 ? "" : "The room runs on nothing."}</p>
        ) : (
          <ul className="space-y-1">
            {here.map((f) => (
              <li key={f.id} className="flex items-center justify-between gap-3">
                <span>
                  <span className="text-[#7FFF6A]">{f.name}</span>{" "}
                  <span className="text-[#E6DFC8]/60">
                    · {jobFor(kindOf(f.roomSlot)).title} · {MOOD_LABEL[f.mood]}
                  </span>
                </span>
                {slot !== 0 && (
                  <form action={assignFork}>
                    <input type="hidden" name="fork" value={f.id} />
                    <input type="hidden" name="slot" value={0} />
                    <button type="submit" className="border border-[#E6DFC8]/40 px-2 py-0.5 text-[#E6DFC8]/80 hover:bg-[#E6DFC8]/10">
                      send off shift
                    </button>
                  </form>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      {elsewhere.length > 0 && (
        <div>
          <p className="mb-1 text-[#E6DFC8]/50">{slot === 0 ? "on shift elsewhere" : `bring to the ${roomName}`}</p>
          <ul className="space-y-1">
            {elsewhere.map((f) => (
              <li key={f.id} className="flex items-center justify-between gap-3">
                <span>
                  <span className="text-[#E6DFC8]">{f.name}</span>{" "}
                  <span className="text-[#E6DFC8]/50">
                    · {jobFor(kindOf(f.roomSlot)).title} · {FORK_TRAITS[f.trait].name}
                  </span>
                </span>
                <form action={assignFork}>
                  <input type="hidden" name="fork" value={f.id} />
                  <input type="hidden" name="slot" value={slot} />
                  <button type="submit" className="border border-[#7FFF6A] px-2 py-0.5 text-[#7FFF6A] hover:bg-[#7FFF6A]/10">
                    {slot === 0 ? "call back" : "assign here"}
                  </button>
                </form>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
