import { useEffect, useRef, useState } from "react";

/**
 * Top margin for a TopBar pop-out so it opens 8 px under the bar (and the
 * AlertBanner). Below lg the anchor is the bar's 108 px bottom edge; from
 * lg it is a 36 px control centred in the 56 px bar, ending at 46 px.
 */
export const popoutGap = (alerting: boolean) => (alerting ? "mt-[52px] lg:mt-[62px]" : "mt-2 lg:mt-[18px]");

/**
 * Open/close state for a TopBar pop-out: Esc closes it and hands focus
 * back to the trigger; a pointer down or Tab focus outside `root` closes
 * it, so two pop-outs are never open at once.
 */
export function useDisclosure() {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setOpen(false);
      trigger.current?.focus();
    };
    // Pointer down or keyboard focus landing outside closes it; focus stays where it went.
    const onOutside = (event: Event) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onOutside);
    document.addEventListener("focusin", onOutside);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onOutside);
      document.removeEventListener("focusin", onOutside);
    };
  }, [open]);

  return { open, setOpen, root, trigger };
}
