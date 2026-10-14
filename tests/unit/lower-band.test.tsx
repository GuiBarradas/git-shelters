import React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { LowerBand } from "@/components/hud/LowerBand";

import { setViewportWidth } from "./viewport";

vi.stubGlobal("React", React);
afterEach(cleanup);

const band = (logHidden = false) =>
  render(
    <LowerBand
      bandRef={() => {}}
      pager={null}
      log={<button>log</button>}
      logHidden={logHidden}
      packet={<button>packet</button>}
      dock={<button>dock</button>}
    />,
  );
const order = () => screen.getAllByRole("button").map((b) => b.textContent);

describe("lower band", () => {
  it("tabs log, dock, packet on the desktop row", () => {
    setViewportWidth(1440);
    band();
    expect(order()).toEqual(["log", "dock", "packet"]);
  });

  it("tabs log, packet, dock on phones, the dock on the bottom edge with extra air above it", () => {
    setViewportWidth(390);
    band();
    expect(order()).toEqual(["log", "packet", "dock"]);
    expect(screen.getByText("dock").parentElement).toHaveClass("max-sm:order-last", "max-sm:mt-5");
  });

  it("keeps the side columns shrinkable so 640 px never scrolls sideways", () => {
    setViewportWidth(640);
    band();
    expect(screen.getByText("log").parentElement!.parentElement).toHaveClass("sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]");
    expect(screen.getByText("log").parentElement).toHaveClass("min-w-0");
    expect(screen.getByText("packet").parentElement).toHaveClass("min-w-0");
  });

  it("hides the log behind the build menu without unmounting it", () => {
    setViewportWidth(1440);
    band(true);
    expect(screen.getByText("log").parentElement).toHaveClass("invisible");
  });
});
