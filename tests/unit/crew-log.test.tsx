import React from "react";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { CrewLog } from "@/components/hud/CrewLog";
import { crewTip } from "@/components/hud/crewTip";
import { resourceAlert } from "@/components/hud/resourceAlert";
import { workforce } from "@/lib/economy/resources";
import { RECRUIT_COST } from "@/lib/forks/catalog";
import type { Fork } from "@/lib/forks/catalog";
import { ROOM_CATALOG, type Room } from "@/lib/rooms/catalog";

vi.stubGlobal("React", React);
afterEach(cleanup);

const fork = (roomSlot: number | null) => ({ roomSlot }) as Fork;
function tipFor(resources: { cache: number; uptime: number }, rooms: Room[], forks: Fork[], bytes: number | null = 0) {
  const state = { payload: 0, ...resources };
  const work = workforce(forks, rooms);
  return crewTip({ resources: state, work, rooms, bytes, alert: resourceAlert({ resources: state, work, rooms, forks, bytes }) });
}

describe("crew log", () => {
  it("counts real Forks and idle hands, then mood, packet and tip lines", () => {
    render(
      <CrewLog mood="happy" lastPushAt={null} echo="pending" forks={[fork(1), fork(null), fork(0)]}
        tip={{ text: "Power Plant has no Engineer.", tone: "text-hud-amber" }} />,
    );
    const log = screen.getByRole("region", { name: "Crew log" });
    expect(log).toHaveTextContent("3 Forks · 2 idle");
    expect(screen.getByText("2 idle")).toHaveClass("text-hud-amber");
    const lines = within(log).getAllByRole("listitem");
    expect(lines.map((l) => l.textContent)).toEqual([
      "> crew mood: happy — no pushes seen yet",
      "> a packet is waiting on the Main Branch terminal",
      "> Power Plant has no Engineer.",
    ]);
  });

  it("drops the lines it has nothing honest for", () => {
    render(<CrewLog mood="content" lastPushAt={null} echo="flat" forks={[fork(1)]} tip={null} />);
    expect(screen.getByRole("region", { name: "Crew log" })).toHaveTextContent("1 Fork · 0 idle");
    expect(screen.getAllByRole("listitem")).toHaveLength(1);
    expect(screen.getByText("0 idle")).not.toHaveClass("text-hud-amber");
  });

  it("collapses to one mood line on small screens that expands over the scene and closes on Escape", () => {
    render(<CrewLog mood="happy" lastPushAt={null} echo="pending" forks={[fork(null)]} tip={null} />);
    const toggle = screen.getByRole("button", { name: "> crew mood: happy — no pushes seen yet" });
    const panel = document.getElementById(toggle.getAttribute("aria-controls")!)!;
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(panel).toHaveClass("max-xl:hidden", "max-xl:absolute", "max-xl:bottom-full");
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(panel).not.toHaveClass("max-xl:hidden");
    // The mood line lives in the toggle there; only the other lines overlay.
    expect(within(panel).getAllByRole("listitem")[0]).toHaveClass("max-xl:hidden");
    fireEvent.keyDown(document, { key: "Escape" });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(toggle).toHaveFocus();
  });
});

describe("crew tip", () => {
  it("warns about the forecast blackout before anything else", () => {
    const rooms: Room[] = [{ slot: 1, kind: "cache_storage" }, { slot: 2, kind: "power_plant" }];
    expect(tipFor({ cache: 100, uptime: 30 }, rooms, [fork(1), fork(null)])?.text).toBe("Power runs out within 8 hours. Cooking and packing stop then.");
  });

  it("asks for the Engineer before the Cook", () => {
    const rooms: Room[] = [{ slot: 1, kind: "cache_storage" }, { slot: 2, kind: "power_plant" }];
    expect(tipFor({ cache: 100, uptime: 100 }, rooms, [fork(null), fork(null)])?.text).toMatch(/^Power Plant has no Engineer/);
  });

  it("never names another room to staff while the AlertBanner names the fix", () => {
    // Blackout with no Power Plant: the unstaffed kitchen is not the answer.
    const tip = tipFor({ cache: 100, uptime: 0 }, [{ slot: 1, kind: "cache_storage" }], [fork(null)]);
    expect(tip?.text ?? "").not.toMatch(/Cook/);
  });

  it("points at what to build next with catalog prices", () => {
    expect(tipFor({ cache: 40, uptime: 100 }, [], [fork(null)])?.text).toContain(`Cache Storage costs ${ROOM_CATALOG.cache_storage.cost} B`);
    const kitchen: Room[] = [{ slot: 1, kind: "cache_storage" }];
    expect(tipFor({ cache: 40, uptime: 100 }, kitchen, [fork(1)])?.text).toContain(`Power Plant costs ${ROOM_CATALOG.power_plant.cost} B`);
  });

  it("suggests the second Fork with the real price and shortfall", () => {
    const rooms: Room[] = [{ slot: 1, kind: "cache_storage" }, { slot: 2, kind: "power_plant" }];
    const tip = tipFor({ cache: 40, uptime: 100 }, rooms, [fork(2)], 20);
    expect(tip?.text).toBe(
      `Cooking and power together need two workers. A second Fork costs ${RECRUIT_COST} B at the Main Branch (${RECRUIT_COST - 20} B more needed).`,
    );
  });
});
