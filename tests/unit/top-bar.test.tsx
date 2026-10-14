import React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AudioProvider } from "@/components/audio/AudioProvider";
import { TopBar } from "@/components/hud/TopBar";

import { setViewportWidth } from "./viewport";

// Keep the server actions behind these out of the test bundle; they have their own tests.
vi.mock("@/components/auth/SyncButton", () => ({ SyncButton: () => <button>Sync</button> }));
vi.mock("@/components/hud/AccountMenu", () => ({ AccountMenu: () => <button>Account</button> }));
vi.mock("next/image", () => ({ default: () => null }));
vi.stubGlobal("React", React);
beforeEach(() => setViewportWidth(1440));
afterEach(cleanup);

const work = { cooks: 1, engineers: 1, tinkerers: 0, forks: 2, cacheStorages: 1, powerPlants: 1, workshops: 0 };
const bar = (bytes: number | null) =>
  render(
    <AudioProvider>
      <TopBar login="GuiBarradas" bytes={bytes} resources={{ cache: 80, uptime: 100, payload: 0 }} work={work} lastSyncedAt={null} />
    </AudioProvider>,
  );

describe("top bar", () => {
  it("shows the balance, the gauges and an icon-only sound switch", () => {
    bar(1709);
    expect(screen.getByText("1,709")).toBeInTheDocument();
    expect(screen.getAllByRole("meter")).toHaveLength(2);
    const sound = screen.getByRole("button", { name: "Sound" });
    expect(sound).toHaveAttribute("aria-pressed", "false");
    expect(sound).not.toHaveTextContent(/\S/);
  });

  it("makes the whole phone resource strip the forecast button, beside the meters rather than around them", () => {
    bar(1709);
    const forecast = screen.getByRole("button", { name: "Forecast" });
    expect(forecast).toHaveClass("max-lg:absolute", "max-lg:inset-0");
    for (const meter of screen.getAllByRole("meter")) expect(forecast).not.toContainElement(meter);
    // The button and the meters share the strip, which anchors the drawer under both bar rows.
    const strip = forecast.closest(".relative")!;
    expect(strip.querySelectorAll('[role="meter"]')).toHaveLength(2);
    // Sound hides on phones (it moves into the account menu there).
    expect(screen.getByRole("button", { name: "Sound" }).parentElement).toHaveClass("hidden", "sm:contents");
  });

  it("tabs in the order each layout shows: one row on desktop, bar then strip on phones", () => {
    const names = () => screen.getAllByRole("button").map((b) => b.textContent || b.getAttribute("aria-label"));
    bar(1709);
    expect(names()).toEqual(["Forecast", "Sound", "Sync", "Account"]);
    // Bytes sits after the gauges on desktop.
    expect(screen.getAllByRole("meter")[0]!.compareDocumentPosition(screen.getByText("1,709"))).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    cleanup();
    setViewportWidth(390);
    bar(1709);
    expect(names()).toEqual(["Sound", "Sync", "Account", "Forecast"]);
    // Bytes by the mascot, before the controls and the strip.
    expect(screen.getByText("1,709").compareDocumentPosition(screen.getAllByRole("meter")[0]!)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
  });

  it("leaves the Bytes box out when the balance is unknown", () => {
    bar(null);
    expect(screen.queryByText("Bytes")).toBeNull();
    expect(screen.queryByText("--")).toBeNull();
  });
});
