"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { generateBunker } from "@/lib/visuals/generate";
import { createDomainRandom } from "@/lib/visuals/seed";
import { ROOM_KINDS, type GeneratedBunker, type VisualRoomKind } from "@/lib/visuals/types";
import type { Fork as ForkData } from "@/lib/forks/catalog";
import RoomScene from "../RoomScene";
import { SnapshotStage, type SnapshotResult } from "./SnapshotStage";

const demoFork: ForkData = { id: "lab-resident-1", name: "Preview", seed: 7, trait: "caffeinated", mood: "content", roomSlot: 0 };
export function downloadRecipe(bunker: GeneratedBunker) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(bunker, null, 2)], { type: "application/json" }));
  const a = document.createElement("a"); a.href = url; a.download = `bunker-${bunker.identity.githubId}.json`; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function SeedBatch({ batch, kind }: { batch: number; kind: VisualRoomKind }) {
  const bunkers = useMemo(() => {
    const random = createDomainRandom(batch, "room", "seed-lab");
    const ids = new Set<number>();
    while (ids.size < 50) ids.add(1 + Math.floor(random() * 2_000_000_000));
    return [...ids].map(id => generateBunker(id, undefined, ROOM_KINDS.map((roomKind, slot) => ({ slot, kind: roomKind }))));
  }, [batch]);
  const [thumbnails, setThumbnails] = useState<{ url: string; calls: number }[]>([]);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<GeneratedBunker | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => { if (selected) dialog.current?.showModal(); }, [selected]);
  const urls = useRef<string[]>([]);
  useEffect(() => () => urls.current.forEach(url => URL.revokeObjectURL(url)), []);
  const current = bunkers[thumbnails.length];
  const room = current?.rooms.find(r => r.kind === kind);
  const capture = ({ blob, calls }: SnapshotResult) => {
    const url = URL.createObjectURL(blob); urls.current.push(url);
    setThumbnails(previous => [...previous, { url, calls }]);
  };
  return <>
    <p className="mb-5 text-sm text-[#aca1b5]" role="status">{error || `${thumbnails.length}/50 thumbnails · one renderer · synthetic accounts, no game progress`}</p>
    {current && room && !error && <SnapshotStage job={{ key: current.identity.githubId, bunker: current, room, forks: [demoFork] }} onCapture={capture} onError={setError} />}
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
      {bunkers.map((bunker, i) => <button key={bunker.identity.githubId} className="overflow-hidden rounded border border-[#67516f] bg-[#18101f] text-left hover:border-[#bd93f9] focus-visible:outline-2 focus-visible:outline-[#bd93f9]" onClick={() => setSelected(bunker)}>
        <div className="aspect-[4/3] bg-[#130e19]">
          {/* Canvas blob URLs are already sized and cannot use the Next image optimizer. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {thumbnails[i] ? <img src={thumbnails[i].url} alt={`Bunker ${bunker.identity.githubId}`} width={480} height={360} /> : <div className="flex h-full items-center justify-center text-xs text-[#97849f]">Queued {i + 1}</div>}
        </div>
        <div className="space-y-2 px-3 py-3 text-xs">
          <p className="text-[#e6dfc8]">#{bunker.identity.githubId}</p>
          <div className="flex gap-1" aria-label="Palette">{Object.values(bunker.identity.palette).map((color, n) => <span key={n} style={{ background: color }} className="h-3 w-3 rounded-sm" />)}</div>
          <p className="text-[#bd93f9]">{bunker.identity.furnitureStyle} · {bunker.identity.signature ?? "no signature"}</p>
          <p className="text-[#97849f]">{bunker.rooms.find(r => r.kind === kind)?.props.length} props · {thumbnails[i]?.calls ?? "—"} calls</p>
        </div>
      </button>)}
    </div>
    {selected && <dialog ref={dialog} onCancel={() => setSelected(null)} aria-label="Seed inspection" className="fixed inset-0 m-0 h-dvh max-h-none w-full max-w-none flex-col bg-[#100b17] text-[#e6dfc8] open:flex">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#594268] p-4">
        <p>#{selected.identity.githubId} · {kind} · {selected.identity.furnitureStyle}</p>
        <div className="flex gap-5"><button onClick={() => downloadRecipe(selected)}>Download JSON</button><button autoFocus onClick={() => setSelected(null)}>Close ×</button></div>
      </div>
      <div className="relative min-h-0 flex-1"><RoomScene kind={kind === "main" ? null : kind} slot={ROOM_KINDS.indexOf(kind)} visuals={selected} forks={[demoFork]} activeToday eventPending={false} /></div>
    </dialog>}
  </>;
}

export function SeedLab() {
  const [batch, setBatch] = useState(1), [kind, setKind] = useState<VisualRoomKind>("main");
  return <main className="min-h-dvh bg-[#100b17] p-5 font-mono text-[#e6dfc8] md:p-8">
    <header className="mb-7 flex flex-wrap items-end justify-between gap-5">
      <div><p className="mb-2 text-xs tracking-[.3em] text-[#bd93f9]">GITSHELTERS / VISUAL TOOLS</p><h1 className="text-3xl">Seed lab</h1><p className="mt-2 text-sm text-[#aca1b5]">50 identities. Same rules. Click a room to inspect it live.</p></div>
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <label>Batch <input aria-label="Batch" className="ml-2 w-20 border border-[#67516f] bg-[#211529] p-2" type="number" min={1} max={999999} value={batch} onChange={e => { const n = Number(e.target.value); if (Number.isSafeInteger(n) && n > 0 && n <= 999999) setBatch(n); }} /></label>
        <select aria-label="Room kind" className="border border-[#67516f] bg-[#211529] p-2" value={kind} onChange={e => setKind(e.target.value as VisualRoomKind)}>{ROOM_KINDS.map(k => <option key={k}>{k}</option>)}</select>
        <button className="border border-[#bd93f9] px-3 py-2 text-[#bd93f9]" onClick={() => setBatch(n => n >= 999999 ? 1 : n + 1)}>New sample →</button>
      </div>
    </header>
    <SeedBatch key={`${batch}:${kind}`} batch={batch} kind={kind} />
  </main>;
}
