import React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AudioProvider } from "@/components/audio/AudioProvider";
import { TopBar } from "@/components/hud/TopBar";

// Keep the server actions behind these out of the test bundle; they have their own tests.
vi.mock("@/components/auth/SyncButton", () => ({ SyncButton: () => null }));
vi.mock("@/components/hud/AccountMenu", () => ({ AccountMenu: () => null }));
vi.mock("next/image", () => ({ default: () => null }));
vi.stubGlobal("React", React);
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

  it("leaves the Bytes box out when the balance is unknown", () => {
    bar(null);
    expect(screen.queryByText("Bytes")).toBeNull();
    expect(screen.queryByText("--")).toBeNull();
  });
});
