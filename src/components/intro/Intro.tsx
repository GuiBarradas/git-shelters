"use client";

import { useEffect, useState, useTransition } from "react";

import { markIntroSeen } from "@/app/intro/actions";

/**
 * The intro (design doc §2.1, §21.2): the lore in four screens and the
 * game in one, typed onto a terminal over the bunker. Plays once; the
 * server remembers. Skippable from the first character.
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
      "Out there, Crawlers wander. In here, the lights still hold.",
      "The ones who made it are Maintainers: devs who locked themselves in their Repos with old batteries, freeze-dried coffee and a local clone of Wikipedia.",
    ],
  },
  {
    head: "you are a maintainer",
    lines: [
      "Your real commits become Bytes. Bytes build rooms. Rooms feed and power your crew, the Forks.",
      "Cache is food. Uptime is power. A packet arrives on the terminal every day; decide what to do with it.",
      "Press Sync after you push. Come back tomorrow. Your absence is canon.",
    ],
  },
];

const CHAR_MS = 18;

export function Intro() {
  const [screen, setScreen] = useState(0);
  const [typed, setTyped] = useState(0);
  const [pending, startTransition] = useTransition();
  const [gone, setGone] = useState(false);

  const current = SCREENS[screen]!;
  const full = current.lines.join("\n");
  const done = typed >= full.length;

  // Typewriter: one character per tick until the screen is fully shown.
  useEffect(() => {
    if (done) return;
    const id = setTimeout(() => setTyped((n) => n + 1), CHAR_MS);
    return () => clearTimeout(id);
  }, [typed, done]);

  const finish = () => {
    setGone(true);
    startTransition(() => markIntroSeen());
  };
  const next = () => {
    if (!done) return setTyped(full.length); // first click completes the screen
    if (screen === SCREENS.length - 1) return finish();
    setScreen((s) => s + 1);
    setTyped(0);
  };

  if (gone) return null;

  return (
    <div
      className="pointer-events-auto absolute inset-0 z-40 flex items-center justify-center bg-[#0B0713]/85 px-4"
      onClick={next}
      role="dialog"
      aria-label="Intro"
    >
      <section className="crt route-enter w-full max-w-xl px-6 py-5 font-mono text-sm text-[#E6DFC8]" onClick={(e) => e.stopPropagation()}>
        <p className="mb-3 text-[10px] uppercase tracking-[0.25em] text-[#BD93F9]/70">
          main-branch:~$ cat /etc/motd · {screen + 1}/{SCREENS.length}
        </p>
        <h2 className="mb-3 uppercase tracking-[0.2em] text-[#BD93F9]">{current.head}</h2>
        <p className="min-h-[7.5rem] whitespace-pre-line leading-relaxed">
          {full.slice(0, typed)}
          {!done && <span className="blink">_</span>}
        </p>
        <div className="mt-4 flex items-center justify-between text-xs">
          <button type="button" onClick={finish} disabled={pending} className="text-[#E6DFC8]/50 hover:text-[#E6DFC8]">
            skip
          </button>
          <button
            type="button"
            onClick={next}
            disabled={pending}
            className="border border-[#BD93F9] px-3 py-1 text-[#BD93F9] transition hover:bg-[#BD93F9]/10"
          >
            {!done ? "show all" : screen === SCREENS.length - 1 ? "enter the Repo" : "next"}
          </button>
        </div>
      </section>
    </div>
  );
}
