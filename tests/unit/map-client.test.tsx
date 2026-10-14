import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { WorldMapClient } from "@/components/map/WorldMapClient";
import type { MapPin } from "@/lib/api/world-map";

const pin = (login: string): MapPin => ({
  login, region: "the_outage", at: [300, 300], bytes: 1200, rooms: 2, badges: 1, memberSince: "2026-05-01T00:00:00Z", activity: 1,
});
const pins = [pin("octocat"), pin("hubot")];

describe("world map client", () => {
  // jsdom has no WebGL: this is the path a browser without it takes.
  it("falls back to the SVG map without WebGL, with the dock on the 404 Lands", () => {
    render(<WorldMapClient pins={pins} me="Octocat" review={false} />);
    expect(screen.getByRole("img", { name: "Map of the 404 Lands" })).toBeInTheDocument();
    expect(document.querySelector("canvas")).toBeNull();
    expect(screen.getByRole("link", { name: "404 Lands" })).toHaveAttribute("aria-current", "page");
  });

  it("lists every Repo as a keyboard-reachable link to its profile, marking the visitor's own", () => {
    render(<WorldMapClient pins={pins} me="octocat" review={false} />);
    const list = screen.getByRole("group");
    expect(within(list).getByText("Repos (2)")).toBeInTheDocument();
    const links = within(list).getAllByRole("link");
    expect(links.map((l) => l.getAttribute("href"))).toEqual(["/u/octocat", "/u/hubot"]);
    expect(links[0]).toHaveTextContent("octocat (you)");
    for (const l of links) expect(l.tabIndex).toBe(0);
  });

  it("labels synthetic review data and links no profile for it", () => {
    render(<WorldMapClient pins={pins} me="octocat" review />);
    expect(screen.getByText(/Synthetic review data · 2 fake Repos, not players/)).toBeInTheDocument();
    expect(within(screen.getByRole("group")).queryAllByRole("link")).toHaveLength(0);
  });
});
