import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { GameDock } from "@/components/hud/GameDock";
import type { GeneratedBunker } from "@/lib/visuals/types";

// The real dialog renders WebGL; the dock only decides when it mounts.
vi.mock("@/components/scene/procedural/BunkerShare", () => ({
  ShareDialog: ({ close }: { close: () => void }) => <div role="dialog" aria-label="Share your bunker"><button onClick={close}>close</button></div>,
}));
vi.stubGlobal("React", React);
afterEach(cleanup);

describe("game dock", () => {
  it("links the bunker and the 404 Lands only, with the bunker marked current", () => {
    render(<GameDock share={null} />);
    const links = screen.getAllByRole("link");
    expect(links.map((l) => l.getAttribute("href"))).toEqual(["/", "/map"]);
    expect(screen.getByRole("link", { name: "Bunker" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "404 Lands" })).not.toHaveAttribute("aria-current");
    expect(screen.queryByText(/crew|badges/i)).toBeNull();
  });

  it("omits Share when there are no visuals to render", () => {
    render(<GameDock share={null} />);
    expect(screen.queryByRole("button", { name: "Share" })).toBeNull();
  });

  it("opens and closes the existing share dialog", () => {
    render(<GameDock share={{ bunker: {} as GeneratedBunker, forks: [] }} />);
    expect(screen.queryByRole("dialog")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Share" }));
    expect(screen.getByRole("dialog", { name: "Share your bunker" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "close" }));
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});
