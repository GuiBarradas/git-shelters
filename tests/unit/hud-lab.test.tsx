import React from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { syncBytes } from "@/app/sync/actions";
import { AudioProvider } from "@/components/audio/AudioProvider";
import { fixtureClick, fixtureTime, HudLab, hudFixture } from "@/components/scene/HudLab";
import type { BunkerSceneProps } from "@/components/scene/BunkerScene";

import { setViewportWidth } from "./viewport";

const { router } = vi.hoisted(() => ({ router: { push: vi.fn(), refresh: vi.fn() } }));
vi.mock("next/navigation", () => ({ useRouter: () => router, usePathname: () => "/dev/scene-lab" }));
// The renderer is WebGL; a button standing in for a room click is enough here.
vi.mock("next/dynamic", () => ({ default: () => function Scene(props: BunkerSceneProps) {
  return <button onClick={() => props.onSlotClick(1, true)}>scene room 1</button>;
} }));
vi.mock("next/image", () => ({ default: () => null }));
vi.mock("@sentry/nextjs", () => ({}));
vi.mock("@/components/scene/SceneQuality", () => ({ useQuality: () => "medium" }));
// The real dialog renders WebGL; this one keeps the publish marker and records a click that gets through.
const { publish } = vi.hoisted(() => ({ publish: vi.fn() }));
vi.mock("@/components/scene/procedural/BunkerShare", () => ({
  ShareDialog: () => <dialog open><button data-share-publish onClick={publish}>Update profile preview</button></dialog>,
}));
// Exposes the prefetch choice; a prefetch would run a stateful game page ahead of navigation.
vi.mock("next/link", () => ({
  default: ({ prefetch, ...props }: React.ComponentProps<"a"> & { prefetch?: boolean; onNavigate?: unknown }) => {
    delete props.onNavigate;
    return <a data-prefetch={String(prefetch)} {...props} />;
  },
}));
// Every Server Action the fixture can reach; none may run.
vi.mock("@/app/sync/actions", () => ({ getBackfillStatus: vi.fn().mockResolvedValue("unavailable"), syncBytes: vi.fn() }));
vi.mock("@/app/rooms/actions", () => ({ buildRoom: vi.fn() }));
vi.mock("@/app/auth/actions", () => ({ signOut: vi.fn() }));
vi.mock("@/app/forks/actions", () => ({ assignFork: vi.fn(), recruitFork: vi.fn() }));
vi.stubGlobal("React", React);
vi.stubGlobal("ResizeObserver", class { observe() {} disconnect() {} });

const AT = "2026-10-14T21:22:48.000Z";
beforeEach(() => { setViewportWidth(1440); vi.clearAllMocks(); });
afterEach(cleanup);

describe("hud fixture", () => {
  it("builds the artboard states through the real helpers, timed from observedAt", () => {
    const normal = hudFixture("normal", AT);
    expect(normal.rooms.map((r) => `${r.slot}:${r.kind}`)).toEqual(["1:cache_storage", "2:power_plant", "3:dorm", "4:elevator", "5:workshop"]);
    expect(normal.forks.map((f) => f.roomSlot)).toEqual([1, 2, 3, 5]);
    expect(normal.resources).toEqual({ cache: 160, uptime: 100, payload: 30 });
    expect(normal.bytes).toBe(1709);
    expect(normal.alert).toBeNull();
    expect(normal.packet).toBe("resolved");
    expect(normal.lastSyncedAt).toBe("2026-10-14T21:08:48.000Z");

    const blackout = hudFixture("blackout", AT);
    expect(blackout.forks.map((f) => f.roomSlot)).toEqual([1, null, 3, 5]);
    expect(blackout.resources).toEqual({ cache: 12, uptime: 0, payload: 30 });
    expect(blackout.mood).toBe("stressed");
    expect(blackout.alert?.kind).toBe("blackout");
    expect(blackout.staffing?.slot).toBe(2);
    expect(blackout.packet).toBe("pending");
    expect(blackout.lastSyncedAt).toBe("2026-10-14T19:22:48.000Z");
  });

  it("accepts a fixed ?at= time and ignores a malformed one", () => {
    expect(fixtureTime(AT)).toBe(AT);
    expect(Number.isFinite(Date.parse(fixtureTime("not a date")))).toBe(true);
    expect(fixtureTime(null)).not.toBe(AT);
  });

  it("walks rooms locally and blocks every other destination and the share upload", () => {
    const el = (html: string) => { const box = document.createElement("div"); box.innerHTML = html; return box.firstElementChild!; };
    expect(fixtureClick(el('<a href="/room/2">go</a>'))).toEqual({ action: "room", slot: 2 });
    expect(fixtureClick(el('<a href="/">back</a>'))).toEqual({ action: "room", slot: null });
    expect(fixtureClick(el('<a href="blob:x" download>png</a>'))).toEqual({ action: "allow" });
    for (const href of ["/map", "/settings", "/u/GuiBarradas", "/?intro=1", "/legal/terms"]) {
      expect(fixtureClick(el(`<a href="${href}">x</a>`))).toEqual({ action: "block" });
    }
    expect(fixtureClick(el("<button data-share-publish>publish</button>"))).toEqual({ action: "block" });
    expect(fixtureClick(el("<button>other</button>"))).toBeNull();
  });
});

describe("hud lab", () => {
  const lab = () => render(<AudioProvider><HudLab fixture="blackout" at={AT} seed={1709} /></AudioProvider>);

  it("renders the real HUD and never runs a Server Action", async () => {
    lab();
    expect(screen.getByText("1,709")).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("Blackout");
    expect(screen.getByRole("region", { name: "Incoming packet" })).toBeInTheDocument();
    const form = screen.getByRole("button", { name: "Sync" }).closest("form")!;
    // fireEvent returns false when the default action was prevented.
    await act(async () => { expect(fireEvent.submit(form)).toBe(false); });
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Sync" })); });
    expect(syncBytes).not.toHaveBeenCalled();
  });

  it("never prefetches a game page and blocks the share upload", () => {
    lab();
    fireEvent.click(screen.getByRole("button", { name: "Account" }));
    for (const link of screen.getAllByRole("link")) expect(link).toHaveAttribute("data-prefetch", "false");
    fireEvent.click(screen.getByRole("button", { name: "Share" }));
    fireEvent.click(screen.getByRole("button", { name: "Update profile preview" }));
    expect(publish).not.toHaveBeenCalled();
  });

  it("opens rooms locally from the banner and the scene, and returns to the corridor", () => {
    lab();
    fireEvent.click(screen.getByRole("link", { name: /Go to Power Plant/ }));
    expect(screen.getByRole("heading", { name: "Power Plant" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("link", { name: /back to the corridor/ }));
    expect(screen.getByRole("region", { name: "Crew log" })).toBeInTheDocument();
    fireEvent.click(screen.getByText("scene room 1"));
    expect(screen.getByRole("heading", { name: "Cache Storage" })).toBeInTheDocument();
    expect(router.push).not.toHaveBeenCalled();
  });

  it("keeps outbound links inert", () => {
    lab();
    fireEvent.click(screen.getByRole("button", { name: "Account" }));
    // fireEvent returns false when the default action was prevented.
    expect(fireEvent.click(screen.getByRole("link", { name: "Settings" }))).toBe(false);
    expect(fireEvent.click(screen.getByRole("link", { name: "404 Lands" }))).toBe(false);
    expect(router.push).not.toHaveBeenCalled();
  });
});
