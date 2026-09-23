"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";

import { markIntroSeen } from "@/app/intro/actions";
import { useAudio } from "@/components/audio/AudioProvider";

/**
 * The intro (design doc §2.1, §21.2): a black screen with the lockup, one
 * click to boot (that click is what lets the browser play sound), then
 * the lore typing itself onto a CRT in time with the theme, and the
 * bunker lighting up under it as the music peaks. Timed to
 * "Uncontained" (3:31, peak ends at 2:50): screens run 0:04 to 2:20,
 * the reveal 2:20 to 2:50, ambience from 2:50. Skip jumps to the reveal
 * and the music crossfades instead of cutting. Plays once per account.
 */

type Screen = { head: string; lines: string[] };

const SCREENS: Screen[] = [
  {
    head: "the great merge conflict",
    lines: [
      "Nobody knows exactly how it started.",
      "Some say a Dependabot woke up and began merging everything into everything.",
      "Others blame a vibe coder who hit Accept All on a PR rewriting the Linux kernel in JavaScript.",
    ],
  },
  {
    head: "a tuesday afternoon",
    lines: [
      "Whatever the reason, late one Tuesday, every public repo in the world entered conflict at once.",
      "Code leaked. Servers rewrote themselves. Containers escaped their clusters.",
      "The CI pipelines became conveyor belts to nowhere.",
    ],
  },
  {
    head: "the 404 lands",
    lines: [
      "What is left of the internet is territory now: fragments where no address resolves.",
      "Out there, Crawlers wander the static.",
      "In here, behind concrete and old batteries, the lights still hold.",
    ],
  },
  {
    head: "the maintainers",
    lines: [
      "The ones who made it locked themselves in their Repos with freeze-dried coffee and a local clone of Wikipedia.",
      "They are not alone. Forks live with them: survivors with names, moods and opinions.",
      "Cache keeps the Forks fed. Uptime keeps the terminal on.",
    ],
  },
  {
    head: "you are a maintainer",
    lines: [
      "Your real commits become Bytes. Bytes build rooms. Rooms give your Forks work.",
      "A packet arrives on the terminal every day. Decide what to do with it.",
      "Press Sync after you push. Come back tomorrow. Your absence is canon.",
    ],
  },
];

/** Timeline in seconds of theme time. */
const T = {
  screensStart: 4,
  screenLength: 27,
  typeLength: 17,
  reveal: 140,
  ambience: 170,
  revealFade: 10,
};

type Phase = "boot" | "screens" | "reveal" | "gone";

export function Intro() {
  const audio = useAudio();
  const [phase, setPhase] = useState<Phase>("boot");
  const [clock, setClock] = useState(0);
  const started = useRef<number | null>(null);
  const finished = useRef(false);

  /** Theme time when the theme drives; wall time since boot otherwise (sound off or blocked). */
  const now = useCallback(() => {
    const t = audio.themeTime();
    if (t !== null && t > 0) return t;
    return started.current === null ? 0 : (performance.now() - started.current) / 1000;
  }, [audio]);

  const finish = useCallback(() => {
    if (finished.current) return;
    finished.current = true;
    void markIntroSeen();
  }, []);

  const reveal = useCallback(
    (fadeMs: number) => {
      setPhase((p) => (p === "reveal" || p === "gone" ? p : "reveal"));
      audio.toAmbience(fadeMs);
      finish();
    },
    [audio, finish],
  );

  const boot = () => {
    started.current = performance.now();
    audio.boot();
    setPhase("screens");
  };

  // One ticker for typing, screen changes and the reveal; 10 Hz is plenty.
  useEffect(() => {
    if (phase !== "screens" && phase !== "reveal") return;
    const id = setInterval(() => {
      const t = now();
      setClock(t);
      if (phase === "screens" && t >= T.reveal) reveal(T.ambience - T.reveal);
    }, 100);
    return () => clearInterval(id);
  }, [phase, now, reveal]);

  // The reveal fades the overlay out; then it is gone. Ambience crossfades at 2:50 on its own timer.
  useEffect(() => {
    if (phase !== "reveal") return;
    const id = setTimeout(() => setPhase("gone"), T.revealFade * 1000);
    return () => clearTimeout(id);
  }, [phase]);

  if (phase === "gone") return null;

  const idx = Math.min(SCREENS.length - 1, Math.max(0, Math.floor((clock - T.screensStart) / T.screenLength)));
  const screen = SCREENS[idx]!;
  const full = screen.lines.join("\n");
  const into = clock - T.screensStart - idx * T.screenLength;
  const typed = clock < T.screensStart ? 0 : Math.min(full.length, Math.floor((into / T.typeLength) * full.length));

  return (
    <div
      role="dialog"
      aria-label="Intro"
      className="pointer-events-auto absolute inset-0 z-40 flex items-center justify-center bg-[#0B0713] px-4"
      style={{
        opacity: phase === "reveal" ? 0 : 1,
        transition: phase === "reveal" ? `opacity ${T.revealFade}s ease-in-out` : undefined,
        pointerEvents: phase === "reveal" ? "none" : "auto",
      }}
    >
      {phase === "boot" ? (
        <div className="route-enter flex max-w-lg flex-col items-center gap-6 text-center font-mono">
          <Image src="/brand/lockup.png" alt="Git Shelters" width={1600} height={560} priority className="h-auto w-full max-w-lg" />
          <p className="text-xs uppercase tracking-[0.3em] text-[#E6DFC8]/50">a game by guibarradas</p>
          <button
            type="button"
            onClick={boot}
            className="border border-[#BD93F9] px-5 py-2 text-sm text-[#BD93F9] transition hover:bg-[#BD93F9]/10"
          >
            boot the Repo
          </button>
          <p className="text-[10px] uppercase tracking-[0.25em] text-[#E6DFC8]/30">sound on · headphones welcome</p>
        </div>
      ) : (
        <section className="crt route-enter w-full max-w-xl px-6 py-5 font-mono text-sm text-[#E6DFC8]">
          <p className="mb-3 text-[10px] uppercase tracking-[0.25em] text-[#BD93F9]/70">
            main-branch:~$ cat /etc/motd · {idx + 1}/{SCREENS.length}
          </p>
          <h2 className="mb-3 uppercase tracking-[0.2em] text-[#BD93F9]">{clock < T.screensStart ? "booting" : screen.head}</h2>
          <p className="min-h-[8.5rem] whitespace-pre-line leading-relaxed">
            {full.slice(0, typed)}
            {typed < full.length && <span className="blink">_</span>}
          </p>
          <div className="mt-4 flex items-center justify-between text-xs">
            <span className="text-[#E6DFC8]/30">
              {Math.floor(clock / 60)}:{String(Math.floor(clock % 60)).padStart(2, "0")}
            </span>
            <button type="button" onClick={() => reveal(4000)} className="text-[#E6DFC8]/50 hover:text-[#E6DFC8]">
              skip to the Repo
            </button>
          </div>
        </section>
      )}
    </div>
  );
}
