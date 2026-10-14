"use client";

import { Fragment, type ReactNode } from "react";

import { useWide } from "@/components/scene/hudInset";

/**
 * Renders keyed children in the order the bar shows them at the current
 * breakpoint, so Tab follows the rows. Keyed fragments move, they do not
 * remount: an open pop-out survives a resize. The server renders `wide`.
 */
export function BarOrder({ items, wide, narrow }: {
  items: Record<string, ReactNode>;
  wide: readonly string[];
  narrow: readonly string[];
}) {
  return (useWide() ? wide : narrow).map((key) => <Fragment key={key}>{items[key]}</Fragment>);
}
