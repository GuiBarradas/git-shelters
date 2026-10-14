import React from "react";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ForecastDrawer } from "@/components/hud/ForecastDrawer";
import type { Workforce } from "@/lib/economy/tick";

vi.stubGlobal("React", React);
afterEach(cleanup);

const idle: Workforce = { cooks: 0, engineers: 0, tinkerers: 0, forks: 2, cacheStorages: 0, powerPlants: 0, workshops: 0 };
const trigger = () => screen.getByRole("button", { name: /Forecast/ });
const drawer = () => screen.queryByRole("region", { name: /Forecast/ });

describe("forecast drawer", () => {
  it("shows the 8-hour simulation for the current crew", () => {
    // Two mouths, no kitchen, no power: 12 meals last 6 of the 8 hours.
    render(<ForecastDrawer resources={{ cache: 12, uptime: 0, payload: 0 }} work={idle} />);
    expect(drawer()).toBeNull();
    fireEvent.click(trigger());
    const rows = within(drawer()!).getAllByRole("row");
    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveTextContent("Cache12 → 0−12");
    expect(rows[1]).toHaveTextContent("Uptime0% → 0%±0");
    expect(drawer()).toHaveTextContent("The lights stay out.");
    expect(drawer()).toHaveTextContent("The crew will run out of food in this window.");
    expect(drawer()).not.toHaveTextContent(/kitchen/i);
  });

  it("lists staffing gaps and the Payload row when a Workshop stands", () => {
    const work = { ...idle, forks: 1, cacheStorages: 1, powerPlants: 1, workshops: 1 };
    render(<ForecastDrawer resources={{ cache: 40, uptime: 100, payload: 5 }} work={work} />);
    fireEvent.click(trigger());
    expect(within(drawer()!).getAllByRole("row")).toHaveLength(3);
    expect(drawer()).toHaveTextContent("Uptime100% → 36%−64");
    expect(drawer()).toHaveTextContent("Cache Storage has no Cook.");
    expect(drawer()).toHaveTextContent("Power Plant has no Engineer.");
    expect(drawer()).toHaveTextContent("Workshop has no Tinkerer.");
    expect(drawer()).not.toHaveTextContent("Power will be depleted");
  });

  it("toggles with aria-expanded and closes on Escape or a click outside", () => {
    render(<><ForecastDrawer resources={{ cache: 40, uptime: 100, payload: 0 }} work={idle} /><p>scene</p></>);
    expect(trigger()).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(trigger());
    expect(trigger()).toHaveAttribute("aria-expanded", "true");
    expect(trigger()).toHaveAttribute("aria-controls", drawer()!.id);
    fireEvent.pointerDown(drawer()!);
    expect(drawer()).not.toBeNull();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(drawer()).toBeNull();
    expect(trigger()).toHaveFocus();
    fireEvent.click(trigger());
    fireEvent.pointerDown(screen.getByText("scene"));
    expect(drawer()).toBeNull();
    expect(trigger()).toHaveAttribute("aria-expanded", "false");
  });

  it("closes when keyboard focus leaves it, without pulling focus back", () => {
    render(<><ForecastDrawer resources={{ cache: 40, uptime: 100, payload: 0 }} work={idle} /><button>account</button></>);
    fireEvent.click(trigger());
    act(() => trigger().focus());
    expect(drawer()).not.toBeNull();
    const elsewhere = screen.getByRole("button", { name: "account" });
    act(() => elsewhere.focus());
    expect(drawer()).toBeNull();
    expect(elsewhere).toHaveFocus();
  });
});
