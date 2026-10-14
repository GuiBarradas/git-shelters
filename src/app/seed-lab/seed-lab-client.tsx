"use client";
import dynamic from "next/dynamic";
const Lab = dynamic(() => import("@/components/scene/procedural/SeedLab").then(module => module.SeedLab), { ssr: false });
export function SeedLabClient() { return <Lab />; }
