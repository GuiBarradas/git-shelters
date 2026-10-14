import React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ResourceGauge } from "@/components/hud/ResourceGauge";

vi.stubGlobal("React", React);
afterEach(cleanup);

/** The desktop bar (16) or the phone strip's (10). */
const bar = (count: 16 | 10 = 16) => document.querySelector(`[data-segments="${count}"]`)!;
const lit = (count: 16 | 10 = 16) => bar(count).querySelectorAll("[data-lit]").length;

describe("resource gauge", () => {
  it("exposes a readable meter with the signed hourly rate", () => {
    render(<ResourceGauge kind="uptime" value={60} cap={100} ratePerHour={17} />);
    const meter = screen.getByRole("meter", { name: "Uptime 60 of 100, charging 17 per hour" });
    expect(meter).toHaveAttribute("aria-valuenow", "60");
    expect(meter).toHaveAttribute("aria-valuemin", "0");
    expect(meter).toHaveAttribute("aria-valuemax", "100");
    expect(bar().children).toHaveLength(16);
    expect(lit()).toBe(10);
    expect(screen.getByText("+17%/h")).toBeInTheDocument();
  });

  it("draws a 10-segment phone bar beside the 16-segment one, both hidden from the one meter", () => {
    render(<ResourceGauge kind="cache" value={60} cap={160} ratePerHour={2} />);
    expect(screen.getAllByRole("meter")).toHaveLength(1);
    expect(bar(16)).toHaveAttribute("aria-hidden", "true");
    expect(bar(16)).toHaveClass("hidden", "lg:flex");
    expect(bar(10)).toHaveAttribute("aria-hidden", "true");
    expect(bar(10)).toHaveClass("lg:hidden");
    expect(bar(10).children).toHaveLength(10);
    expect(lit(16)).toBe(6);
    expect(lit(10)).toBe(4);
  });

  it("says FULL at the cap and lights every segment", () => {
    render(<ResourceGauge kind="cache" value={160} cap={160} ratePerHour={5} />);
    expect(screen.getByRole("meter", { name: "Cache 160 of 160, full" })).toBeInTheDocument();
    expect(screen.getByText("FULL")).toBeInTheDocument();
    expect(lit()).toBe(16);
  });

  it("says FULL on a draining full store and keeps the drain for screen readers", () => {
    render(<ResourceGauge kind="cache" value={40} cap={40} ratePerHour={-4} />);
    expect(screen.getByText("FULL")).toBeInTheDocument();
    expect(screen.queryByText("−4/h")).toBeNull();
    expect(screen.getByRole("meter", { name: "Cache 40 of 40, full, falling 4 per hour" })).toBeInTheDocument();
  });

  it("turns red under 20% and outlines empty segments at zero", () => {
    const { rerender } = render(<ResourceGauge kind="cache" value={10} cap={160} ratePerHour={-4} />);
    expect(screen.getByText("10/160")).toHaveClass("text-hud-red-text");
    expect(lit()).toBe(1);
    rerender(<ResourceGauge kind="cache" value={0} cap={160} ratePerHour={-4} />);
    expect(screen.getByRole("meter", { name: "Cache 0 of 160, falling 4 per hour" })).toBeInTheDocument();
    expect(lit()).toBe(0);
    for (const segment of [...bar(16).children, ...bar(10).children]) expect(segment).toHaveClass("border-hud-red");
  });

  it("shows no rate when none is given", () => {
    render(<ResourceGauge kind="payload" value={3} cap={30} />);
    expect(screen.getByRole("meter", { name: "Payload 3 of 30" })).toBeInTheDocument();
    expect(screen.queryByText(/\/h$/)).toBeNull();
  });
});
