import React from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Intro } from "@/components/intro/Intro";
import { finishIntro, markIntroSeen } from "@/app/intro/actions";

const { audio } = vi.hoisted(() => ({ audio: { boot: vi.fn(), themeTime: vi.fn(), toAmbience: vi.fn() } }));
vi.mock("@/components/audio/AudioProvider", () => ({ useAudio: () => audio }));
vi.mock("@/app/intro/actions", () => ({ markIntroSeen: vi.fn(), finishIntro: vi.fn() }));
vi.mock("next/image", () => ({ default: () => null }));
vi.stubGlobal("React", React);
beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  audio.themeTime.mockReturnValue(0);
  vi.mocked(markIntroSeen).mockResolvedValue(undefined);
  vi.mocked(finishIntro).mockResolvedValue(undefined);
});
afterEach(() => { cleanup(); vi.useRealTimers(); });

describe("intro milestones", () => {
  it("boot records a start, while skip records a skipped finish", () => {
    render(<Intro login="test" />);
    fireEvent.click(screen.getByRole("button", { name: "boot the Repo" }));
    expect(markIntroSeen).toHaveBeenCalledOnce();
    expect(finishIntro).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "skip to the Repo" }));
    expect(finishIntro).toHaveBeenCalledExactlyOnceWith("skipped");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
  it("only records completion at the end of the fade", () => {
    render(<Intro login="test" />);
    fireEvent.click(screen.getByRole("button", { name: "boot the Repo" }));
    audio.themeTime.mockReturnValue(155);
    act(() => vi.advanceTimersByTime(100));
    expect(finishIntro).not.toHaveBeenCalled();
    audio.themeTime.mockReturnValue(170);
    act(() => vi.advanceTimersByTime(100));
    expect(finishIntro).toHaveBeenCalledExactlyOnceWith("completed");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
