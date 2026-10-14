import React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { PacketCard } from "@/components/hud/PacketCard";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.stubGlobal("React", React);
afterEach(cleanup);

const observedAt = "2026-10-14T21:22:48Z";

describe("packet card", () => {
  it("sends a pending packet to the Main Branch terminal", () => {
    render(<PacketCard packet="pending" observedAt={observedAt} />);
    expect(screen.getByRole("region", { name: "Incoming packet" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Open terminal/ })).toHaveAttribute("href", "/room/0");
    expect(screen.queryByRole("timer")).toBeNull();
  });

  it("counts down to the next packet once today's is resolved", () => {
    render(<PacketCard packet="resolved" observedAt={observedAt} />);
    expect(screen.getByRole("region", { name: "Next packet" })).toHaveTextContent("today ✓ resolved");
    expect(screen.getByRole("timer")).toHaveTextContent("02:37:12");
    expect(screen.queryByRole("link")).toBeNull();
  });

  it("shows nothing rather than a fake packet when no event loaded", () => {
    const { container } = render(<PacketCard packet={null} observedAt={observedAt} />);
    expect(container).toBeEmptyDOMElement();
  });
});
