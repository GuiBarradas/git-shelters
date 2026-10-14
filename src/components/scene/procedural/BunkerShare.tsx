"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Fork as ForkData } from "@/lib/forks/catalog";
import type { GeneratedBunker } from "@/lib/visuals/types";
import { SnapshotStage, type SnapshotResult } from "./SnapshotStage";

/** Render, download and publish the share card. Mounting it opens the modal; `close` unmounts it. */
export function ShareDialog({ bunker, forks, close }: { bunker: GeneratedBunker; forks: ForkData[]; close: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => { dialog.current?.showModal(); }, []);
  const [capture, setCapture] = useState<SnapshotResult | null>(null), [error, setError] = useState(""), [busy, setBusy] = useState(false), [published, setPublished] = useState("");
  const room = useMemo(() => [...bunker.rooms].sort((a,b) => {
    const score = (r: typeof a) => r.props.length + (r.kind === "main" ? 4 : 0) + r.props.filter(p => ["aquarium","cat","flag"].includes(p.kind)).length * 8;
    return score(b) - score(a) || a.slot - b.slot;
  })[0]!, [bunker]);
  const image = useMemo(() => capture ? URL.createObjectURL(capture.blob) : null, [capture]);
  useEffect(() => () => { if (image) URL.revokeObjectURL(image); }, [image]);
  async function publish() {
    if (!capture) return;
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/bunker-card", { method: "POST", headers: { "Content-Type": "image/png" }, body: capture.blob });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Could not save the preview.");
      setPublished(data.url);
    } catch (err) { setError(err instanceof Error ? err.message : "Could not save the preview."); }
    finally { setBusy(false); }
  }
  return <dialog ref={dialog} onCancel={close} aria-label="Share your bunker" className="fixed inset-0 m-0 h-dvh max-h-none w-full max-w-none items-center justify-center bg-[#09060e]/95 p-4 font-mono text-[#e6dfc8] open:flex">
    <div className="w-full max-w-3xl border border-[#67516f] bg-[#18101f] p-5">
      <div className="mb-4 flex justify-between gap-5"><h2>Share your bunker</h2><button autoFocus onClick={close} aria-label="Close share preview">×</button></div>
      {!capture && !error && <SnapshotStage job={{ key: `share-${bunker.identity.githubId}`, bunker, room, forks: forks.filter(f => (f.roomSlot ?? 0) === room.slot), width: 960, height: 720 }} onCapture={setCapture} onError={setError} />}
      {/* Canvas blobs and the dynamic OG route bypass the Next image optimizer. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {image ? <img className="max-h-[60vh] w-full object-contain" src={published || image} alt="Your bunker sharing preview" /> : <p className="py-20 text-center">Rendering your room…</p>}
      <p className="mt-4 text-xs text-[#aca1b5]">Update the image shown when someone shares your public profile. The card adds your current balance, living Forks and built rooms.</p>
      {error && <p role="alert" className="mt-3 text-sm text-[#f2b482]">{error}</p>}
      <div className="mt-5 flex flex-wrap gap-5 text-sm">
        {/* data-share-publish: the scene lab's HUD fixture blocks this upload by marker. */}
        <button data-share-publish disabled={!capture || busy} className="border border-[#bd93f9] px-3 py-2 text-[#bd93f9] disabled:opacity-40" onClick={publish}>{busy ? "Saving…" : published ? "Update again" : "Update profile preview"}</button>
        {image && <a className="py-2" href={image} download="gitshelters-room.png">Download room PNG</a>}
        {published && <a className="py-2 text-[#bd93f9]" href={published} target="_blank" rel="noreferrer">Open share card ↗</a>}
      </div>
    </div>
  </dialog>;
}
