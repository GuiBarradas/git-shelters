import React from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { getBackfillStatus, syncBytes } from "@/app/sync/actions";
import { SyncButton } from "@/components/auth/SyncButton";

const { router } = vi.hoisted(() => ({ router: { refresh: vi.fn() } }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));
vi.mock("@/app/sync/actions", () => ({ getBackfillStatus: vi.fn(), syncBytes: vi.fn() }));
vi.stubGlobal("React", React);

beforeEach(() => vi.clearAllMocks());
afterEach(() => { cleanup(); vi.useRealTimers(); });

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
