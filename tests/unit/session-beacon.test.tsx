import React from "react";
import { cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { SessionBeacon } from "@/components/analytics/SessionBeacon";

vi.stubGlobal("React", React);

let now = 0;
let visibility: DocumentVisibilityState = "visible";
const sendBeacon = vi.fn<(url: string, body: Blob) => boolean>(() => true);

function setVisibility(v: DocumentVisibilityState) {
  visibility = v;
  document.dispatchEvent(new Event("visibilitychange"));
}

async function sent() {
  return Promise.all(sendBeacon.mock.calls.map(([, body]) => body.text().then((t) => JSON.parse(t))));
}

beforeEach(() => {
  now = 0;
  visibility = "visible";
  sendBeacon.mockClear();
  vi.spyOn(performance, "now").mockImplementation(() => now);
  vi.spyOn(document, "visibilityState", "get").mockImplementation(() => visibility);
  Object.defineProperty(navigator, "sendBeacon", { value: sendBeacon, configurable: true });
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("SessionBeacon", () => {
  it("sends one segment per visible stretch and excludes hidden time", async () => {
    render(<SessionBeacon />);
    now = 1_000;
    setVisibility("hidden");
    now = 60_000; // hidden for a minute: must not count
    setVisibility("visible");
    now = 62_500;
    setVisibility("hidden");

    expect(await sent()).toEqual([
      { duration_ms: 1_000, measurement: "visible_segment" },
      { duration_ms: 2_500, measurement: "visible_segment" },
    ]);
  });

  it("does not duplicate a segment across hidden, pagehide and unmount", async () => {
    const { unmount } = render(<SessionBeacon />);
    now = 4_000;
    setVisibility("hidden");
    window.dispatchEvent(new Event("pagehide"));
    unmount();

    expect(await sent()).toEqual([{ duration_ms: 4_000, measurement: "visible_segment" }]);
  });

  it("flushes on pagehide without a visibility change and not again on unmount", async () => {
    const { unmount } = render(<SessionBeacon />);
    now = 3_000;
    window.dispatchEvent(new Event("pagehide"));
    unmount();
    expect(await sent()).toEqual([{ duration_ms: 3_000, measurement: "visible_segment" }]);
  });

  it("flushes the open segment on unmount", async () => {
    const { unmount } = render(<SessionBeacon />);
    now = 700;
    unmount();
    expect(await sent()).toEqual([{ duration_ms: 700, measurement: "visible_segment" }]);
  });

  it("starts the clock only when a page opened hidden becomes visible", async () => {
    visibility = "hidden";
    const { unmount } = render(<SessionBeacon />);
    now = 10_000;
    window.dispatchEvent(new Event("pagehide"));
    expect(sendBeacon).not.toHaveBeenCalled();

    setVisibility("visible");
    now = 12_000;
    unmount();
    expect(await sent()).toEqual([{ duration_ms: 2_000, measurement: "visible_segment" }]);
  });

  it("resumes a new segment when restored from the back/forward cache", async () => {
    const { unmount } = render(<SessionBeacon />);
    now = 1_000;
    window.dispatchEvent(new Event("pagehide"));
    now = 50_000;
    window.dispatchEvent(new Event("pageshow"));
    now = 51_000;
    unmount();
    expect(await sent()).toEqual([
      { duration_ms: 1_000, measurement: "visible_segment" },
      { duration_ms: 1_000, measurement: "visible_segment" },
    ]);
  });
});
