import Image from "next/image";

import { signInWithGithub } from "@/app/auth/actions";
import { BunkerSceneClient } from "@/components/scene/BunkerSceneClient";
import type { Fork } from "@/lib/forks/catalog";
import type { Room } from "@/lib/rooms/catalog";

/** Prefab bunker every visitor sees: the three Public Alpha rooms, lights on. */
const DEMO_ROOMS: Room[] = [
  { slot: 1, kind: "cache_storage" },
  { slot: 2, kind: "power_plant" },
  { slot: 3, kind: "dorm" },
  { slot: 4, kind: "elevator" },
];

/** One survivor pacing the demo so the place looks lived in. */
const DEMO_FORKS: Fork[] = [
  { id: "demo-1", name: "Linus_77", trait: "caffeinated", mood: "content", roomSlot: 0, seed: 77 },
  { id: "demo-2", name: "Margie_NULL", trait: "senior", mood: "content", roomSlot: 1, seed: 1204 },
  { id: "demo-3", name: "Hex_root", trait: "vibe_coder", mood: "happy", roomSlot: 3, seed: 31337 },
];

/** Real profile shown as "what this looks like after a while". */
const SHOWCASE_LOGIN = "GuiBarradas";

/**
 * Anonymous landing: the demo bunker orbiting behind the pitch and the
 * single call to action. Read-only by construction (bytes = null, demo).
 */
export function Landing() {
  return (
    <main className="relative w-full h-dvh">
      <BunkerSceneClient rooms={DEMO_ROOMS} forks={DEMO_FORKS} bytes={null} activeToday demo />

      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex justify-center px-4 pt-10 sm:pt-16">
        <div className="max-w-xl space-y-4 text-center font-mono">
          <Image src="/brand/lockup.png" alt="Git Shelters" width={1600} height={327} priority unoptimized className="mx-auto h-auto w-full max-w-sm" />
          <h1 className="text-xl leading-snug text-[#E6DFC8] sm:text-2xl">
            Your commits build the bunker. Your idle still earns. Your absence is canon.
          </h1>
          <p className="text-sm text-[#E6DFC8]/60">
            An idle base-builder where real GitHub activity feeds an apocalypse.
          </p>
          <form action={signInWithGithub} className="pointer-events-auto pt-2">
            <button
              type="submit"
              className="border border-[#BD93F9] bg-[#0B0713]/80 px-5 py-2 text-sm text-[#BD93F9] transition hover:bg-[#BD93F9]/10"
            >
              Connect with GitHub
            </button>
          </form>
          <a
            href={`/u/${SHOWCASE_LOGIN}`}
            className="pointer-events-auto inline-block text-xs text-[#E6DFC8]/50 underline underline-offset-4 hover:text-[#E6DFC8]"
          >
            or peek at a real Repo
          </a>
          <a
            href="/map"
            className="pointer-events-auto ml-4 inline-block text-xs text-[#E6DFC8]/50 underline underline-offset-4 hover:text-[#E6DFC8]"
          >
            or see the 404 Lands
          </a>
        </div>
      </div>

      <p className="pointer-events-none absolute bottom-6 left-6 z-10 hidden font-mono text-[10px] uppercase tracking-widest text-[#E6DFC8]/30 sm:block">
        drag to look around
      </p>
    </main>
  );
}
