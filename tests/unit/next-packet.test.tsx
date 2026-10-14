import React from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { NextPacket } from "@/components/events/NextPacket";
import { nextPacketAt } from "@/lib/events/schedule";

const refresh = vi.hoisted(() => vi.fn());
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
vi.stubGlobal("React", React);
afterEach(() => { cleanup(); vi.useRealTimers(); vi.clearAllMocks(); });

describe("next daily event", () => {
  it("uses the next UTC midnight, including offset input and year rollover", () => {
    expect(nextPacketAt("2026-12-31T20:59:59-03:00")).toBe("2027-01-01T00:00:00.000Z");
    expect(nextPacketAt("2026-12-31T21:00:00-03:00")).toBe("2027-01-02T00:00:00.000Z");
  });

  it("counts down HH:MM:SS from the server's clock and names the UTC reset day", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-14T21:22:48Z"));
    render(<NextPacket observedAt="2026-10-14T21:22:48Z" availableAt={nextPacketAt("2026-10-14T21:22:48Z")} />);
    expect(screen.getByRole("timer")).toHaveTextContent("02:37:12");
    expect(screen.getByText(/Resets 00:00 UTC/)).toHaveTextContent("Resets 00:00 UTC · Oct 15");
    act(() => { vi.advanceTimersByTime(2000); });
    expect(screen.getByRole("timer")).toHaveTextContent("02:37:10");
  });

  it("offers refresh when the fixed deadline passes instead of starting another countdown", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-05T23:59:59Z"));
    render(<NextPacket observedAt="2026-10-05T23:59:59Z" availableAt="2026-10-06T00:00:00Z" />);
    expect(screen.getByRole("timer")).toHaveTextContent("00:00:01");
    act(() => { vi.advanceTimersByTime(1000); });
    expect(screen.queryByRole("timer")).toBeNull();
    expect(refresh).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: /new daily event is ready/ }));
    expect(refresh).toHaveBeenCalledOnce();
  });
});
