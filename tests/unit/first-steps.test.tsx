import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { openNotice } from "@/app/notices/actions";
import { FirstSteps } from "@/components/hud/FirstSteps";
import { WELCOME } from "@/lib/notices";

vi.mock("@/app/notices/actions", () => ({ openNotice: vi.fn() }));
// Next compiles JSX with the automatic runtime; expose React for Vitest's JSX transform.
vi.stubGlobal("React", React);

const notice = { id: "welcome-test", ...WELCOME };
const defaults = { notices: [], eventDone: false, eventAvailable: true, built: false, bytes: 100, onBuild: vi.fn() };

afterEach(cleanup);
beforeEach(() => vi.clearAllMocks());

describe("first steps", () => {
  it("does not reopen completed onboarding for an unstaffed room", () => {
    render(<FirstSteps {...defaults} built eventDone staffingRoom={{ slot: 2, name: "Power Plant" }} />);
    expect(screen.queryByRole("complementary")).not.toBeInTheDocument();
  });

  it("guides an idle worker while the first event is still incomplete", () => {
    render(<FirstSteps {...defaults} built staffingRoom={{ slot: 2, name: "Power Plant" }} />);
    expect(screen.getByRole("link", { name: "Assign your first worker · free" })).toHaveAttribute("href", "/room/2");
    expect(screen.getByRole("link", { name: "Read your first event" })).toBeInTheDocument();
  });
  it("keeps a failed collection retryable, and waits for confirmation", async () => {
    vi.mocked(openNotice).mockResolvedValueOnce({ tone: "warn", bytes: 0, message: "Try again", at: 1 });
    render(<FirstSteps {...defaults} notices={[notice]} />);
    expect(screen.queryByRole("button", { name: "Choose your first room" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Collect 100 B" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Try again");
    expect(screen.getByRole("button", { name: "Collect 100 B" })).toBeEnabled();

    vi.mocked(openNotice).mockResolvedValueOnce({ tone: "ok", bytes: 100, message: "+100 B collected", at: 2 });
    fireEvent.click(screen.getByRole("button", { name: "Collect 100 B" }));
    expect(await screen.findByRole("status")).toHaveTextContent("+100 B collected");
    expect(screen.queryByRole("button", { name: "Collect 100 B" })).not.toBeInTheDocument();
    expect(vi.mocked(openNotice).mock.calls[1]?.[1].get("id")).toBe(notice.id);
  });

  it("also keeps transport failures retryable", async () => {
    vi.mocked(openNotice).mockRejectedValueOnce(new Error("offline"));
    render(<FirstSteps {...defaults} notices={[notice]} />);
    fireEvent.click(screen.getByRole("button", { name: "Collect 100 B" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Connection lost");
    await waitFor(() => expect(screen.getByRole("button", { name: "Collect 100 B" })).toBeEnabled());
  });

  it("advances from collection to construction to the terminal with refreshed persisted state", () => {
    const { rerender } = render(<FirstSteps {...defaults} notices={[notice]} />);
    rerender(<FirstSteps {...defaults} />);
    fireEvent.click(screen.getByRole("button", { name: "Choose your first room" }));
    expect(defaults.onBuild).toHaveBeenCalledOnce();
    rerender(<FirstSteps {...defaults} built />);
    expect(screen.getByRole("link", { name: "Read your first event" })).toHaveAttribute("href", "/room/0");
    rerender(<FirstSteps {...defaults} built eventDone />);
    expect(screen.queryByRole("complementary")).not.toBeInTheDocument();
  });

  it("does not require replaying an event completed before the first build", () => {
    const { rerender } = render(<FirstSteps {...defaults} eventDone />);
    expect(screen.getByRole("button", { name: "Choose your first room" })).toBeInTheDocument();
    rerender(<FirstSteps {...defaults} eventDone built />);
    expect(screen.queryByRole("complementary")).not.toBeInTheDocument();
  });

  it("keeps an unclaimed welcome visible for established players and unavailable history", () => {
    render(<FirstSteps {...defaults} built eventDone={null} notices={[notice]} />);
    expect(screen.getByRole("button", { name: "Collect 100 B" })).toBeInTheDocument();
    expect(screen.queryByRole("list")).not.toBeInTheDocument();
  });

  it("offers the event as an alternative when the balance cannot fund a room", () => {
    render(<FirstSteps {...defaults} bytes={0} />);
    expect(screen.getByText(/50 more B/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Read today's event" })).toHaveAttribute("href", "/room/0");
  });
});
