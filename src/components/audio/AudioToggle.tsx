"use client";

import { useAudio } from "@/components/audio/AudioProvider";

/** Footer switch for the Repo's sound. */
export function AudioToggle() {
  const { enabled, toggle } = useAudio();
  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={enabled}
      title={enabled ? "Sound on" : "Sound off"}
      className="uppercase tracking-widest hover:text-[#E6DFC8]"
    >
      {enabled ? "♪ on" : "♪ off"}
    </button>
  );
}
