"use client";

import { useAudio } from "@/components/audio/AudioProvider";

/** The Repo's sound switch: "♪ on/off" text in the footer, a note icon in the bunker's TopBar. */
export function AudioToggle({ variant = "text" }: { variant?: "text" | "icon" }) {
  const { enabled, toggle } = useAudio();
  if (variant === "icon") {
    return (
      <button
        type="button"
        onClick={toggle}
        aria-pressed={enabled}
        aria-label="Sound"
        title={enabled ? "Sound on" : "Sound off"}
        className={`flex h-9 w-9 items-center justify-center border border-hud-violet/40 hover:bg-hud-violet/10 ${enabled ? "text-hud-violet" : "text-hud-bone/60"}`}
      >
        <svg aria-hidden viewBox="0 0 16 16" className="h-4 w-4 fill-none stroke-current" strokeWidth={1.4}>
          <path d="M6 12V3l7-1.5v9" />
          <circle cx="4.25" cy="12" r="1.75" />
          <circle cx="11.25" cy="10.5" r="1.75" />
          {!enabled && <path d="M2 2l12 12" />}
        </svg>
      </button>
    );
  }
  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={enabled}
      title={enabled ? "Sound on" : "Sound off"}
      className="uppercase tracking-widest hover:text-hud-bone"
    >
      {enabled ? "♪ on" : "♪ off"}
    </button>
  );
}
