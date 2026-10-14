import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AlertBanner } from "@/components/hud/AlertBanner";
import type { ResourceAlert } from "@/components/hud/resourceAlert";

vi.stubGlobal("React", React);
afterEach(cleanup);

const blackout: ResourceAlert = { kind: "blackout", roomKind: "power_plant", role: "Engineer", room: null, ratePerHour: -8, build: null };
const pantry: ResourceAlert = { kind: "pantry", roomKind: "cache_storage", role: "Cook", room: { slot: 1, staffed: true }, ratePerHour: 0, build: null };

describe("alert banner", () => {
  it("sends the player to the unstaffed room", () => {
    render(<AlertBanner alert={{ ...blackout, room: { slot: 2, staffed: false } }} />);
    expect(screen.getByRole("alert")).toHaveTextContent("Cooking and packing stopped. Put an Engineer in the Power Plant.");
    expect(screen.getByRole("link", { name: /Go to Power Plant/ })).toHaveAttribute("href", "/room/2");
  });

  it("does not ask for a worker the room already has", () => {
    render(<AlertBanner alert={{ ...blackout, room: { slot: 2, staffed: true }, ratePerHour: 17 }} />);
    expect(screen.getByRole("alert")).not.toHaveTextContent(/Put an Engineer/);
    expect(screen.getByRole("alert")).toHaveTextContent("An Engineer is on shift; the battery is recharging.");
    expect(screen.getByRole("link", { name: /Check Power Plant/ })).toHaveAttribute("href", "/room/2");
  });

  it("says a staffed kitchen breaks even at zero and falls behind below it", () => {
    const view = render(<AlertBanner alert={pantry} />);
    expect(screen.getByRole("alert")).toHaveTextContent("The pantry is empty. The Cooks only make what the crew eats.");
    expect(screen.getByRole("alert")).not.toHaveTextContent(/faster/);
    view.rerender(<AlertBanner alert={{ ...pantry, ratePerHour: -2 }} />);
    expect(screen.getByRole("alert")).toHaveTextContent("The crew eats faster than the Cooks cook.");
    expect(screen.getByRole("link", { name: /Check Cache Storage/ })).toHaveAttribute("href", "/room/1");
  });

  it("drops the link inside the room it points to", () => {
    render(<AlertBanner alert={{ ...blackout, room: { slot: 2, staffed: false } }} currentSlot={2} />);
    expect(screen.queryByRole("link")).toBeNull();
  });

  it("opens the build menu in the overview, or links there from a room", () => {
    const onBuild = vi.fn();
    const alert = { ...blackout, build: { cost: 80, slot: 3 as const, missing: 0 } };
    const view = render(<AlertBanner alert={alert} onBuild={onBuild} />);
    fireEvent.click(screen.getByRole("button", { name: "Build Power Plant · 80 B" }));
    expect(onBuild).toHaveBeenCalledOnce();
    view.rerender(<AlertBanner alert={alert} />);
    expect(screen.getByRole("link", { name: /Build Power Plant · 80 B/ })).toHaveAttribute("href", "/?build=power_plant");
  });

  it("prices a build the player cannot afford yet on a disabled button", () => {
    const onBuild = vi.fn();
    render(<AlertBanner alert={{ ...blackout, build: { cost: 80, slot: 3, missing: 30 } }} onBuild={onBuild} />);
    const button = screen.getByRole("button", { name: "Build Power Plant · 80 B" });
    expect(button).toBeDisabled();
    expect(button).toHaveAccessibleDescription("30 B more needed.");
    fireEvent.click(button);
    expect(onBuild).not.toHaveBeenCalled();
    expect(screen.queryByRole("link")).toBeNull();
  });

  it("offers no action when the balance is unknown or no slot is free", () => {
    const { rerender } = render(<AlertBanner alert={{ ...blackout, build: { cost: 80, slot: 3, missing: null } }} onBuild={vi.fn()} />);
    expect(screen.getByRole("alert")).toHaveTextContent("There is no Power Plant. Power Plant costs 80 B.");
    expect(screen.queryByRole("button")).toBeNull();
    rerender(<AlertBanner alert={{ ...pantry, room: null, build: { cost: 50, slot: null, missing: 0 } }} onBuild={vi.fn()} />);
    expect(screen.getByRole("alert")).toHaveTextContent("The pantry is empty. There is no Cache Storage. No free slot to build one.");
    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.queryByRole("link")).toBeNull();
  });
});
