"use client";

import { createContext, useContext, type ComponentProps } from "react";
import type { BunkerIdentity } from "@/lib/visuals/types";
import "../DioramaMaterial";

export const VisualContext = createContext<BunkerIdentity | null>(null);
export const VisualPower = createContext(1);
export function VisualMaterial(props: ComponentProps<"dioramaMaterial">) {
  const identity = useContext(VisualContext);
  const power = useContext(VisualPower);
  return <dioramaMaterial power={power} {...(identity ? {warmTint: identity.palette.warmLight, coolTint: identity.palette.emissive, wear: identity.wear} : {})} {...props} />;
}
