import React from "react";
import { act, cleanup, fireEvent, render, renderHook, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { RoomPager } from "@/components/hud/RoomPager";
import { hudTop } from "@/components/scene/hudInset";
import { clampPage, PAGES, setPage, swipeStep, useOverviewPage } from "@/components/scene/pager";
import { clampToScreen } from "@/components/scene/RoomOverlay";

vi.stubGlobal("React", React);
beforeEach(() => {
  sessionStorage.clear();
  act(() => setPage(0));
});
afterEach(cleanup);

describe("overview pages", () => {
  it("frames every column in pairs, the last page overlapping instead of showing a lone room", () => {
    expect(PAGES).toEqual([[0, 1], [2, 3], [3, 4]]);
    expect(new Set(PAGES.flat())).toEqual(new Set([0, 1, 2, 3, 4]));
    expect(clampPage(-1)).toBe(0);
    expect(clampPage(7)).toBe(2);
    expect(clampPage(Number.NaN)).toBe(0);
  });

  it("pages on a clear sideways swipe only", () => {
    expect(swipeStep(-60, 10)).toBe(1);
    expect(swipeStep(60, -10)).toBe(-1);
    // Under the 40 px threshold: a tap or a wobble.
    expect(swipeStep(-40, 0)).toBe(0);
    expect(swipeStep(8, 2)).toBe(0);
    // Too diagonal: |dx| must beat 1.5 × |dy|.
    expect(swipeStep(-60, 40)).toBe(0);
    expect(swipeStep(-61, 40)).toBe(1);
  });

  it("keeps the page for the session, so walking out of a room returns to the same columns", () => {
    const { result, unmount } = renderHook(() => useOverviewPage());
    expect(result.current).toBe(0);
    act(() => setPage(2));
    expect(result.current).toBe(2);
    expect(sessionStorage.getItem("gs.overview-page")).toBe("2");
    unmount();
    expect(renderHook(() => useOverviewPage()).result.current).toBe(2);
    act(() => setPage(9));
    expect(sessionStorage.getItem("gs.overview-page")).toBe("2");
  });
});

describe("room pager", () => {
  it("shows the current page and moves with buttons, dots and arrow keys", () => {
    const onPage = vi.fn();
    render(<RoomPager page={1} onPage={onPage} />);
    expect(screen.getByRole("group", { name: "Bunker columns" })).toHaveClass("sm:hidden");
    expect(screen.getByRole("button", { name: "Rooms 2 of 3" })).toHaveAttribute("aria-current", "true");
    expect(screen.getByRole("button", { name: "Rooms 1 of 3" })).not.toHaveAttribute("aria-current");
    fireEvent.click(screen.getByRole("button", { name: "Next rooms" }));
    expect(onPage).toHaveBeenLastCalledWith(2);
    fireEvent.click(screen.getByRole("button", { name: "Rooms 1 of 3" }));
    expect(onPage).toHaveBeenLastCalledWith(0);
    fireEvent.keyDown(screen.getByRole("button", { name: "Previous rooms" }), { key: "ArrowLeft" });
    expect(onPage).toHaveBeenLastCalledWith(0);
    fireEvent.keyDown(screen.getByRole("button", { name: "Rooms 3 of 3" }), { key: "ArrowRight" });
    expect(onPage).toHaveBeenLastCalledWith(2);
  });

  it("keeps the end arrows focusable and clamps at the ends", () => {
    const onPage = vi.fn();
    render(<RoomPager page={2} onPage={onPage} />);
    const next = screen.getByRole("button", { name: "Next rooms" });
    expect(next).toBeEnabled();
    expect(next).toHaveAttribute("aria-disabled", "true");
    fireEvent.click(next);
    expect(onPage).toHaveBeenLastCalledWith(2);
  });
});

describe("hud insets", () => {
  it("reserves the one-row bar from lg and the two-row bar below, plus the banner", () => {
    expect(hudTop(false, true)).toBe(56);
    expect(hudTop(true, true)).toBe(100);
    expect(hudTop(false, false)).toBe(108);
    expect(hudTop(true, false)).toBe(152);
  });

  it("trims the staffing outline to the screen and hides it when its room is paged away", () => {
    expect(clampToScreen({ left: -50, top: 0, right: 100, bottom: 80 }, 390)).toEqual({ left: 0, top: 0, right: 100, bottom: 80 });
    expect(clampToScreen({ left: 380, top: 0, right: 520, bottom: 80 }, 390)).toBeNull();
    expect(clampToScreen({ left: 500, top: 0, right: 640, bottom: 80 }, 390)).toBeNull();
  });
});
