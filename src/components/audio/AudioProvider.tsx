"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useSyncExternalStore } from "react";

/**
 * The Repo's sound: one theme (the intro, played once) and two ambience
 * tracks that alternate forever. Lives in the root layout so a walk from
 * the corridor into a room does not restart anything.
 *
 * Browsers refuse to play audio without a user gesture, so nothing starts
 * on its own: the intro's boot click starts the theme, the toggle starts
 * the ambience, and a returning player who left sound on gets it back on
 * their first click or key press. The preference lives in localStorage
 * (per browser, never sent anywhere).
 */

const THEME = "/audio/theme.mp3";
const AMBIENCE = ["/audio/ambience-1.mp3", "/audio/ambience-2.mp3"];
const THEME_VOLUME = 0.55;
const AMBIENCE_VOLUME = 0.32;
const PREF_KEY = "gs.audio";

type Mode = "idle" | "theme" | "ambience";

type AudioApi = {
  enabled: boolean;
  /** Flip the preference; starting counts as a gesture because it is a click. */
  toggle: () => void;
  /** The intro's boot click: sound on, theme from the top. */
  boot: () => void;
  /** Fade the theme out and the ambience in. Safe to call twice. */
  toAmbience: (fadeMs?: number) => void;
  /** Seconds into the theme, or null when it is not the thing playing. */
  themeTime: () => number | null;
};

const Ctx = createContext<AudioApi | null>(null);

export function useAudio(): AudioApi {
  const api = useContext(Ctx);
  if (!api) throw new Error("useAudio outside AudioProvider");
  return api;
}

function readPref(): boolean {
  try {
    return localStorage.getItem(PREF_KEY) === "on";
  } catch {
    return false;
  }
}

// The preference is an external store (localStorage) read through
// useSyncExternalStore: no state set in an effect, no hydration mismatch
// (the server snapshot is always "off").
const listeners = new Set<() => void>();
function subscribe(cb: () => void) {
  listeners.add(cb);
  window.addEventListener("storage", cb);
  return () => {
    listeners.delete(cb);
    window.removeEventListener("storage", cb);
  };
}
function writePref(on: boolean) {
  try {
    localStorage.setItem(PREF_KEY, on ? "on" : "off");
  } catch {
    // private mode or blocked storage: the session still works, it just forgets
  }
  for (const l of listeners) l();
}

/** Linear volume ramp; resolves when done. Cancels nothing: callers sequence it. */
function ramp(el: HTMLAudioElement, to: number, ms: number): Promise<void> {
  return new Promise((resolve) => {
    const from = el.volume;
    if (ms <= 0) {
      el.volume = to;
      return resolve();
    }
    const start = performance.now();
    const tick = () => {
      const k = Math.min(1, (performance.now() - start) / ms);
      el.volume = from + (to - from) * k;
      if (k < 1) requestAnimationFrame(tick);
      else resolve();
    };
    requestAnimationFrame(tick);
  });
}

export function AudioProvider({ children }: { children: React.ReactNode }) {
  const theme = useRef<HTMLAudioElement | null>(null);
  const ambience = useRef<HTMLAudioElement | null>(null);
  const mode = useRef<Mode>("idle");
  const track = useRef(0);
  const enabled = useSyncExternalStore(subscribe, readPref, () => false);

  // Create the elements once, on the client.
  useEffect(() => {
    const t = new Audio(THEME);
    t.preload = "auto";
    t.volume = THEME_VOLUME;
    const a = new Audio(AMBIENCE[0]);
    a.preload = "auto";
    a.volume = AMBIENCE_VOLUME;
    // Alternate the two ambience tracks forever.
    a.addEventListener("ended", () => {
      track.current = (track.current + 1) % AMBIENCE.length;
      a.src = AMBIENCE[track.current]!;
      void a.play().catch(() => undefined);
    });
    theme.current = t;
    ambience.current = a;
    return () => {
      t.pause();
      a.pause();
    };
  }, []);

  const playAmbience = useCallback(() => {
    const a = ambience.current;
    if (!a) return;
    mode.current = "ambience";
    a.volume = AMBIENCE_VOLUME;
    void a.play().catch(() => undefined);
  }, []);

  // Sound was left on: resume the ambience on the first gesture of the visit.
  useEffect(() => {
    if (!enabled || mode.current !== "idle") return;
    const once = () => {
      if (mode.current === "idle") playAmbience();
      window.removeEventListener("pointerdown", once);
      window.removeEventListener("keydown", once);
    };
    window.addEventListener("pointerdown", once);
    window.addEventListener("keydown", once);
    return () => {
      window.removeEventListener("pointerdown", once);
      window.removeEventListener("keydown", once);
    };
  }, [enabled, playAmbience]);

  const api = useMemo<AudioApi>(
    () => ({
      enabled,
      toggle: () => {
        const on = !enabled;
        writePref(on);
        if (on) {
          if (mode.current !== "theme") playAmbience();
        } else {
          theme.current?.pause();
          ambience.current?.pause();
          mode.current = "idle";
        }
      },
      boot: () => {
        writePref(true);
        const t = theme.current;
        if (!t) return;
        ambience.current?.pause();
        mode.current = "theme";
        t.currentTime = 0;
        t.volume = THEME_VOLUME;
        void t.play().catch(() => undefined);
      },
      toAmbience: (fadeMs = 6000) => {
        const t = theme.current;
        const a = ambience.current;
        if (!a || mode.current === "ambience") return;
        const wasTheme = mode.current === "theme";
        mode.current = "ambience";
        if (!enabled && !wasTheme) return; // sound is off: remember the mode, play nothing
        a.volume = 0;
        void a.play().catch(() => undefined);
        void ramp(a, AMBIENCE_VOLUME, fadeMs);
        if (t && wasTheme) void ramp(t, 0, fadeMs).then(() => t.pause());
      },
      themeTime: () => (mode.current === "theme" && theme.current ? theme.current.currentTime : null),
    }),
    [enabled, playAmbience],
  );

  return <Ctx.Provider value={api}>{children}</Ctx.Provider>;
}
