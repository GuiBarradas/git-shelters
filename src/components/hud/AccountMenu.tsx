"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";

import { signOut } from "@/app/auth/actions";
import { setQuality, useQuality, type Quality } from "@/components/scene/quality";

const QUALITIES: Quality[] = ["low", "medium", "high"];
const ROW = "flex items-center gap-3 px-4 py-2.5 text-sm text-hud-bone hover:bg-hud-violet/10";
const SMALL = "text-[10px] uppercase tracking-[0.22em]";

/** 16 px row icons in currentColor, after the artboard: a profile card, a play screen, sliders. */
function Icon({ d }: { d: string }) {
  return (
    <svg aria-hidden viewBox="0 0 16 16" className="h-4 w-4 shrink-0 fill-none stroke-current text-hud-violet" strokeWidth={1.4}>
      <path d={d} />
    </svg>
  );
}
const REPO_ICON = "M2 3h12v10H2zM5 7h6M5 10h3";
const REPLAY_ICON = "M2 2.5h12v9H2zM6.5 5v4l3.5-2zM5 14h6";
const SETTINGS_ICON = "M2 4h12M2 8h12M2 12h12M5 2.5v3M10 6.5v3M7 10.5v3";

/** "GuiBarradas" -> "GB"; falls back to the first two letters. */
const initials = (login: string) => (login.match(/[A-Z]/g)?.slice(0, 2).join("") || login.slice(0, 2)).toUpperCase();

/**
 * The avatar menu: public Repo, intro replay, settings, visual quality,
 * legal and logout. A disclosure, not an ARIA menu: Tab moves through it,
 * Esc or a click outside closes it and hands focus back to the avatar.
 */
export function AccountMenu({ login }: { login: string | null }) {
  const [open, setOpen] = useState(false);
  const quality = useQuality();
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const id = useId();

  useEffect(() => {
    if (!open) return;
    panel.current?.querySelector<HTMLElement>("a, button, input")?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setOpen(false);
      trigger.current?.focus();
    };
    const onPointer = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointer);
    };
  }, [open]);

  const tag = login ? initials(login) : "··";
  const close = () => setOpen(false);

  return (
    <div ref={root} className="relative">
      <button
        ref={trigger}
        type="button"
        aria-expanded={open}
        aria-controls={id}
        aria-label="Account"
        onClick={() => setOpen((v) => !v)}
        className={`flex h-9 items-center gap-2 border pl-1 pr-2 text-xs ${open ? "border-hud-violet" : "border-hud-violet/40"} hover:bg-hud-violet/10`}
      >
        <span className="flex h-7 w-7 items-center justify-center bg-hud-plum text-hud-bone">{tag}</span>
        <svg aria-hidden viewBox="0 0 10 10" className={`h-2.5 w-2.5 fill-none stroke-current text-hud-violet ${open ? "rotate-180" : ""}`} strokeWidth={1.4}>
          <path d="M2 3.5 5 6.5 8 3.5" />
        </svg>
      </button>
      {open && (
        <div
          ref={panel}
          id={id}
          role="region"
          aria-label="Account"
          className="absolute right-0 top-full z-30 mt-2 w-80 max-w-[calc(100vw-2rem)] border border-hud-violet bg-hud-bg/95 font-mono"
        >
          <div className="flex items-center gap-3 border-b border-hud-violet/40 p-4">
            <span className="flex h-10 w-10 items-center justify-center bg-hud-plum text-hud-bone">{tag}</span>
            <div className="min-w-0">
              <p className="truncate text-sm text-hud-bone">{login ?? "Maintainer"}</p>
              <p className={`${SMALL} text-hud-bone/60`}>Maintainer · The Outage</p>
            </div>
          </div>
          <nav className="border-b border-hud-violet/40 py-1">
            {login && (
              <Link href={`/u/${login}`} onClick={close} className={ROW}>
                <Icon d={REPO_ICON} />
                Public Repo
                <span className="ml-auto truncate text-xs text-hud-bone/60">/u/{login}</span>
              </Link>
            )}
            <Link href="/?intro=1" onClick={close} className={ROW}>
              <Icon d={REPLAY_ICON} />
              Intro / credits
              <span className={`ml-auto ${SMALL} text-hud-violet`}>Replay</span>
            </Link>
            <Link href="/settings" onClick={close} className={ROW}>
              <Icon d={SETTINGS_ICON} />
              Settings
            </Link>
          </nav>
          <div className="border-b border-hud-violet/40 p-4">
            <p id={`${id}-visual`} className={`${SMALL} mb-2 text-hud-bone/60`}>Visual</p>
            <div role="radiogroup" aria-labelledby={`${id}-visual`} className="flex border border-hud-violet/40">
              {QUALITIES.map((q) => (
                <label key={q} className="flex-1">
                  <input
                    type="radio"
                    name={`${id}-quality`}
                    value={q}
                    checked={quality === q}
                    onChange={() => setQuality(q)}
                    className="peer sr-only"
                  />
                  <span className={`block py-2 text-center ${SMALL} text-hud-violet peer-checked:bg-hud-violet peer-checked:text-hud-bg peer-focus-visible:outline peer-focus-visible:outline-1 peer-focus-visible:outline-hud-violet`}>
                    {q}
                  </span>
                </label>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-4 p-4">
            <Link href="/legal/privacy" onClick={close} className={`${SMALL} text-hud-bone/60 hover:text-hud-bone`}>
              Privacy
            </Link>
            <Link href="/legal/terms" onClick={close} className={`${SMALL} text-hud-bone/60 hover:text-hud-bone`}>
              Terms
            </Link>
            <form action={signOut} className="ml-auto">
              <button type="submit" className={`border border-hud-violet/60 px-3 py-1.5 ${SMALL} text-hud-violet hover:bg-hud-violet/10`}>
                Log out
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
