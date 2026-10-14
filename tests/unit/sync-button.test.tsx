import React from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { getBackfillStatus, syncBytes } from "@/app/sync/actions";
import { elapsedLabel, SyncButton } from "@/components/auth/SyncButton";

const { router } = vi.hoisted(() => ({ router: { refresh: vi.fn() } }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));
vi.mock("@/app/sync/actions", () => ({ getBackfillStatus: vi.fn(), syncBytes: vi.fn() }));
vi.stubGlobal("React", React);

beforeEach(() => vi.clearAllMocks());
afterEach(() => { cleanup(); vi.useRealTimers(); });

it("formats the sync age", () => {
  const t = Date.parse("2026-10-14T12:00:00Z");
  expect(elapsedLabel(t, t + 30_000)).toBe("now");
  expect(elapsedLabel(t, t + 14 * 60_000)).toBe("14m");
  expect(elapsedLabel(t, t + 3 * 3_600_000)).toBe("3h");
  expect(elapsedLabel(t, t + 50 * 3_600_000)).toBe("2d");
  expect(elapsedLabel(t, t - 60_000)).toBe("now");
});

describe("sync feedback", () => {
  it("keeps a failed import retryable and shows the confirmed result", async () => {
    vi.mocked(getBackfillStatus).mockResolvedValueOnce("failed").mockResolvedValue("done");
    vi.mocked(syncBytes).mockResolvedValue({ tone: "ok", message: "Initial sync complete.", at: 1 });
    render(<SyncButton />);
    fireEvent.click(await screen.findByRole("button", { name: "Retry sync" }));
    expect(await screen.findByText(/Initial sync complete/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sync" })).toBeEnabled();
  });

  it("recovers when the action request itself fails", async () => {
    vi.mocked(getBackfillStatus).mockResolvedValue("done");
    vi.mocked(syncBytes).mockRejectedValue(new Error("offline"));
    render(<SyncButton />);
    fireEvent.click(screen.getByRole("button", { name: "Sync" }));
    expect(await screen.findByRole("button", { name: "Retry sync" })).toBeEnabled();
    expect(screen.getByRole("status")).toHaveTextContent("Sync failed. Try again.");
  });

  it("shows the age of the stored last sync, and nothing when it is unknown", async () => {
    // The label ticks per whole minute; pin the clock to one so the age is exact.
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(Date.parse("2026-10-14T12:30:00Z"));
    vi.mocked(getBackfillStatus).mockResolvedValue("done");
    const view = render(<SyncButton lastSyncedAt="2026-10-14T12:15:30Z" />);
    expect(await screen.findByText("14m")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sync" })).toBeEnabled();
    view.rerender(<SyncButton lastSyncedAt={null} />);
    expect(screen.queryByText(/^\d+[mhd]$|^now$/)).toBeNull();
  });

  it("does not lose a minute to the seconds of the clock", async () => {
    // The HUD fixture's case: synced exactly 14 min and 2 h before a clock at :48 s.
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(Date.parse("2026-10-14T02:22:48Z"));
    vi.mocked(getBackfillStatus).mockResolvedValue("done");
    const view = render(<SyncButton lastSyncedAt="2026-10-14T02:08:48Z" />);
    expect(await screen.findByText("14m")).toBeInTheDocument();
    view.rerender(<SyncButton lastSyncedAt="2026-10-14T00:22:48Z" />);
    expect(await screen.findByText("2h")).toBeInTheDocument();
  });

  it("counts from a successful sync on this visit", async () => {
    vi.mocked(getBackfillStatus).mockResolvedValue("done");
    vi.mocked(syncBytes).mockResolvedValue({ tone: "ok", message: "up to date", at: Date.now() });
    render(<SyncButton />);
    fireEvent.click(screen.getByRole("button", { name: "Sync" }));
    expect(await screen.findByText("now")).toBeInTheDocument();
  });

  it("checks an import until completion, refreshes the balance, then stops", async () => {
    vi.useFakeTimers();
    vi.mocked(getBackfillStatus).mockResolvedValueOnce("in_progress").mockResolvedValue("done");
    render(<SyncButton />);
    await act(async () => {});
    expect(screen.getByRole("button")).toBeDisabled();
    expect(screen.getByRole("status")).toHaveTextContent("last 30 days");
    await act(async () => { await vi.advanceTimersByTimeAsync(5000); });
    expect(router.refresh).toHaveBeenCalledOnce();
    expect(screen.getByRole("button", { name: "Sync" })).toBeEnabled();
    await act(async () => { await vi.advanceTimersByTimeAsync(10000); });
    expect(getBackfillStatus).toHaveBeenCalledTimes(2);
  });
});
