"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";

import { markIntroSeen } from "@/app/intro/actions";
import { useAudio } from "@/components/audio/AudioProvider";

/**
 * The intro (design doc §2.1, §21.2), scored by "Uncontained" (3:31,
 * peak ends at 2:50). A black boot screen with the lockup; one click
 * starts the music (browsers need the gesture). Then, in theme time:
 *
 *   0:00  login: BOOTING blinks, the mascot logs in, clearance accepted
 *   0:10  the lore, five screens typing themselves, 27 s each
 *   2:25  logout: clearance off, the mascot logs out
 *   2:35  the CRT fades and the bunker shows through, lit, by 2:50
 *   2:50  the theme fades over 20 s while the ambience comes up
 *
 * Skip jumps to the reveal and crossfades at once. Plays once per
 * account; /?intro=1 replays it.
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
  login: 10,
  screenLength: 27,
  typeLength: 17,
  logout: 145,
  logoff: 149,
  fadeStart: 155,
  fadeEnd: 170,
  crossfade: 20,
};

type Phase = "boot" | "playing" | "gone";

export function Intro({ login }: { login: string | null }) {
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

  const boot = () => {
    started.current = performance.now();
    audio.boot();
    setPhase("playing");
  };

  /** Skip: bunker now, music handed over now. */
  const skip = () => {
    finish();
    audio.toAmbience(4000);
    setPhase("gone");
  };

  // One ticker, 10 Hz: typing, scene changes, the fade and the handover.
  useEffect(() => {
    if (phase !== "playing") return;
    const id = setInterval(() => {
      const t = now();
      setClock(t);
      if (t >= T.fadeStart) finish();
      if (t >= T.fadeEnd) {
        audio.toAmbience(T.crossfade * 1000);
        setPhase("gone");
      }
    }, 100);
    return () => clearInterval(id);
  }, [phase, now, finish, audio]);

  if (phase === "gone") return null;

  const opacity = clock < T.fadeStart ? 1 : Math.max(0, 1 - (clock - T.fadeStart) / (T.fadeEnd - T.fadeStart));
  const scene = clock < T.login ? "login" : clock < T.logout ? "screens" : "logout";
  const stamp = `${Math.floor(clock / 60)}:${String(Math.floor(clock % 60)).padStart(2, "0")}`;

  return (
    <div
      role="dialog"
      aria-label="Intro"
      className="absolute inset-0 z-40 flex items-center justify-center bg-[#0B0713] px-4"
      style={{ opacity, pointerEvents: clock >= T.fadeStart ? "none" : "auto" }}
    >
      {phase === "boot" ? (
        <div className="route-enter flex max-w-lg flex-col items-center gap-6 text-center font-mono">
          <Image src="/brand/lockup.png" alt="Git Shelters" width={1600} height={327} priority unoptimized className="h-auto w-full max-w-lg" />
          <p className="text-xs uppercase tracking-[0.3em] text-[#E6DFC8]/50">a game by guibarradas</p>
          <button
            type="button"
            onClick={boot}
            className="border border-[#BD93F9] px-5 py-2 text-sm text-[#BD93F9] transition hover:bg-[#BD93F9]/10"
          >
            boot the Repo
          </button>
          <p className="text-[10px] uppercase tracking-[0.25em] text-[#E6DFC8]/30">sound on · headphones welcome</p>
          <p className="max-w-sm text-[10px] leading-relaxed text-[#E6DFC8]/30">
            music: &ldquo;Uncontained&rdquo; by Alana Jordan · ambience by Mezhdunami and turning_pages · Pixabay Content License
            <br />
            art, code and words by guibarradas · code AGPL-3.0
          </p>
        </div>
      ) : (
        <section className="crt route-enter w-full max-w-xl px-6 py-5 font-mono text-sm text-[#E6DFC8]">
          <p className="mb-3 text-[10px] uppercase tracking-[0.25em] text-[#BD93F9]/70">
            main-branch:~$ {scene === "screens" ? "cat /etc/motd" : scene === "login" ? "login" : "logout"}
            {scene === "screens" && ` · ${Math.min(SCREENS.length, Math.floor((clock - T.login) / T.screenLength) + 1)}/${SCREENS.length}`}
          </p>
          <div className="min-h-[11rem]">
            {scene === "login" && <Login t={clock} login={login} />}
            {scene === "screens" && <Lore t={clock - T.login} />}
            {scene === "logout" && <Logout t={clock - T.logout} login={login} />}
          </div>
          <div className="mt-4 flex items-center justify-between text-xs">
            <span className="text-[#E6DFC8]/30">{stamp}</span>
            <button type="button" onClick={skip} className="text-[#E6DFC8]/50 hover:text-[#E6DFC8]">
              skip to the Repo
            </button>
          </div>
        </section>
      )}
    </div>
  );
}

/** Types `text` over `seconds`, from t = 0. */
function typedSlice(text: string, t: number, seconds: number): string {
  return text.slice(0, Math.max(0, Math.min(text.length, Math.floor((t / seconds) * text.length))));
}

/** 0:00 to 0:10: BOOTING blinks, the mascot materialises, clearance is accepted, it nods. */
function Login({ t, login }: { t: number; login: string | null }) {
  const who = login ?? "maintainer";
  const line = `identifying ${who}... clearance accepted.`;
  return (
    <div className="flex flex-col items-center gap-4 text-center">
      <h2 className="uppercase tracking-[0.2em] text-[#BD93F9]">
        booting<span className="blink">_</span>
      </h2>
      <div
        className={t >= 8 ? "nod" : undefined}
        style={{
          opacity: t < 2.5 ? 0 : Math.min(1, (t - 2.5) / 1.5),
          transform: t < 2.5 ? "scale(0.6)" : t < 4 ? `scale(${0.6 + ((t - 2.5) / 1.5) * 0.4})` : undefined,
          filter: t >= 6 ? "drop-shadow(0 0 14px rgba(189,147,249,0.8))" : "drop-shadow(0 0 4px rgba(189,147,249,0.3))",
          transition: "filter 600ms ease",
        }}
      >
        <Image src="/brand/mascot-pixel.png" alt="" width={56} height={56} unoptimized className="pixel h-28 w-28" />
      </div>
      <p className="min-h-[1.5rem] text-[#E6DFC8]/85">
        {t >= 5.5 && typedSlice(line, t - 5.5, 2.5)}
        {t >= 5.5 && t < 8 && <span className="blink">_</span>}
      </p>
      <p className="text-[10px] uppercase tracking-[0.25em] text-[#BD93F9]/60" style={{ opacity: t >= 8 ? 1 : 0 }}>
        lock in · welcome to the Repo
      </p>
    </div>
  );
}

/** 0:10 to 2:25: five screens, each typing for 17 s then holding. */
function Lore({ t }: { t: number }) {
  const idx = Math.min(SCREENS.length - 1, Math.max(0, Math.floor(t / T.screenLength)));
  const screen = SCREENS[idx]!;
  const full = screen.lines.join("\n");
  const shown = typedSlice(full, t - idx * T.screenLength, T.typeLength);
  return (
    <>
      <h2 className="mb-3 uppercase tracking-[0.2em] text-[#BD93F9]">{screen.head}</h2>
      <p className="whitespace-pre-line leading-relaxed">
        {shown}
        {shown.length < full.length && <span className="blink">_</span>}
      </p>
    </>
  );
}

/** 2:25 on: LOGOUT blinks, clearance off, the mascot logs off; the CRT then fades to the bunker. */
function Logout({ t, login }: { t: number; login: string | null }) {
  const who = login ?? "maintainer";
  const line = `${who} signing off... clearance off. The Repo is yours.`;
  return (
    <div className="flex flex-col items-center gap-4 text-center">
      <h2 className="uppercase tracking-[0.2em] text-[#BD93F9]">
        logout<span className="blink">_</span>
      </h2>
      <div
        className={t >= T.logoff - T.logout ? "logoff" : undefined}
        style={{ filter: "drop-shadow(0 0 14px rgba(189,147,249,0.8))" }}
      >
        <Image src="/brand/mascot-pixel.png" alt="" width={56} height={56} unoptimized className="pixel h-28 w-28" />
      </div>
      <p className="min-h-[1.5rem] text-[#E6DFC8]/85">
        {typedSlice(line, t - 0.5, 3)}
        {t < 4 && <span className="blink">_</span>}
      </p>
    </div>
  );
}
