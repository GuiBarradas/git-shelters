"use client";

import { useActionState } from "react";

import { openNotice, type OpenState } from "@/app/notices/actions";
import { WELCOME, type Notice } from "@/lib/notices";

const IDLE: OpenState = { tone: "idle", bytes: 0, message: "", at: 0 };

/** Each packet owns its action state; failed collections remain available to retry. */
export function Packets({ notices }: { notices: Notice[] }) {
  return notices.map((notice) => <Packet key={notice.id} notice={notice} />);
}

function Packet({ notice }: { notice: Notice }) {
  const [state, action, pending] = useActionState(async (previous: OpenState, formData: FormData) => {
    try {
      return await openNotice(previous, formData);
    } catch {
      return { tone: "warn" as const, bytes: 0, message: "Connection lost. Try collecting again.", at: Date.now() };
    }
  }, IDLE);
  const welcome = notice.ref === WELCOME.ref;

  return (
    <section aria-label={notice.title} className="border border-hud-amber/70 bg-hud-amber/10 p-3">
      <h3 className="font-bold text-hud-amber">{notice.title}</h3>
      <p className="mt-1 leading-relaxed text-hud-bone/80">
        {welcome ? `${notice.bytes} B are waiting for you. Collect them to help build your first room.` : notice.body}
      </p>
      {state.tone === "ok" ? (
        <p role="status" className="mt-2 text-hud-amber">{state.message}</p>
      ) : (
        <form action={action} className="mt-3">
          <input type="hidden" name="id" value={notice.id} />
          <button type="submit" disabled={pending} aria-busy={pending}
            className="min-h-11 w-full border border-hud-amber bg-hud-amber px-3 py-2 font-bold text-hud-bg hover:bg-hud-amber/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-hud-bone disabled:opacity-60">
            {pending ? "Collecting…" : notice.bytes > 0 ? `Collect ${notice.bytes} B` : "Open packet"}
          </button>
          {state.tone === "warn" && <p role="alert" className="mt-2 text-hud-bone">{state.message}</p>}
        </form>
      )}
    </section>
  );
}
