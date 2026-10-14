import React from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { BunkerViewport, ClearBunkerScene, RegisteredBunkerScene, useBunkerFocus } from "@/components/scene/BunkerViewport";
import Loading from "@/app/loading";
import type { BunkerSceneProps } from "@/components/scene/BunkerScene";

const route = vi.hoisted(() => ({ path: "/" }));
vi.mock("next/navigation", () => ({ usePathname: () => route.path }));
// A canvas element is enough to detect remounts; real WebGL/camera are covered by the scene lab.
vi.mock("next/dynamic", () => ({ default: () => function Scene(props: BunkerSceneProps) {
  return <><canvas data-testid="canvas" data-slot={props.focusedSlot ?? "corridor"} />
    <button disabled={!props.interactive} onClick={() => props.onSlotClick(1, true)}>enter</button>
    <div>{props.panel}</div>
  </>;
} }));
vi.stubGlobal("React", React);

const defaults: BunkerSceneProps = { rooms: [{ slot: 1, kind: "cache_storage" }], activeToday: true, onSlotClick: vi.fn() };
function Back() {
  const focus = useBunkerFocus();
  return <button onClick={() => focus?.(null)}>back</button>;
}
function Page({ slot = null, revision = 1 }: { slot?: number | null; revision?: number }) {
  return <RegisteredBunkerScene {...defaults} focusedSlot={slot} panel={slot === null ? undefined : <p>panel {revision}</p>} />;
}
beforeEach(() => { route.path = "/"; vi.clearAllMocks(); });
afterEach(cleanup);

it("keeps the same renderer through outgoing updates, server loading, room actions and return", () => {
  const view = render(<BunkerViewport><Page /><Back /></BunkerViewport>);
  const canvas = screen.getByTestId("canvas");
  fireEvent.click(screen.getByText("enter"));
  expect(defaults.onSlotClick).toHaveBeenCalledOnce();
  expect(canvas).toHaveAttribute("data-slot", "1");
  view.rerender(<BunkerViewport><Page revision={2} /><Back /></BunkerViewport>);
  expect(canvas).toHaveAttribute("data-slot", "1");
  expect(screen.getByText("enter")).toBeDisabled();
  view.rerender(<BunkerViewport><Loading /></BunkerViewport>);
  expect(screen.queryByText(/resolving route/)).toBeNull();
  expect(screen.getByTestId("canvas")).toBe(canvas);
  route.path = "/room/1";
  view.rerender(<BunkerViewport><Page slot={1} /><Back /></BunkerViewport>);
  expect(screen.getByText("panel 1")).toBeInTheDocument();
  view.rerender(<BunkerViewport><Page slot={1} revision={2} /><Back /></BunkerViewport>);
  expect(screen.getByText("panel 2")).toBeInTheDocument();
  fireEvent.click(screen.getByText("back"));
  expect(canvas).toHaveAttribute("data-slot", "corridor");
  expect(screen.queryByText("panel 2")).toBeNull();
  route.path = "/";
  view.rerender(<BunkerViewport><Page /><Back /></BunkerViewport>);
  expect(screen.getByTestId("canvas")).toBe(canvas);
  expect(screen.getByText("enter")).toBeEnabled();
});

it("opens a direct room URL and preserves its canvas on browser back/forward", () => {
  route.path = "/room/1";
  const view = render(<BunkerViewport><Page slot={1} /></BunkerViewport>);
  const canvas = screen.getByTestId("canvas");
  expect(canvas).toHaveAttribute("data-slot", "1");
  act(() => {
    window.history.replaceState(null, "", "/");
    window.dispatchEvent(new PopStateEvent("popstate"));
  });
  expect(canvas).toHaveAttribute("data-slot", "corridor");
  route.path = "/";
  view.rerender(<BunkerViewport><Page /></BunkerViewport>);
  act(() => {
    window.history.replaceState(null, "", "/room/1");
    window.dispatchEvent(new PopStateEvent("popstate"));
  });
  route.path = "/room/1";
  view.rerender(<BunkerViewport><Page slot={1} /></BunkerViewport>);
  expect(canvas).toHaveAttribute("data-slot", "1");
  expect(screen.getByTestId("canvas")).toBe(canvas);
});

it("cancels an unfinished zoom on history back and releases the scene outside game routes", () => {
  const view = render(<BunkerViewport><Page /></BunkerViewport>);
  fireEvent.click(screen.getByText("enter"));
  act(() => {
    window.history.replaceState(null, "", "/");
    window.dispatchEvent(new PopStateEvent("popstate"));
  });
  expect(screen.getByTestId("canvas")).toHaveAttribute("data-slot", "corridor");
  expect(screen.getByText("enter")).toBeEnabled();
  route.path = "/settings";
  view.rerender(<BunkerViewport><p>settings</p></BunkerViewport>);
  expect(screen.queryByTestId("canvas")).toBeNull();
});

it("clears old room data on errors/404s and can retry", () => {
  const view = render(<BunkerViewport><Page slot={1} /></BunkerViewport>);
  view.rerender(<BunkerViewport><ClearBunkerScene /></BunkerViewport>);
  expect(screen.queryByTestId("canvas")).toBeNull();
  expect(screen.queryByText("panel 1")).toBeNull();
  view.rerender(<BunkerViewport><Page slot={1} revision={2} /></BunkerViewport>);
  expect(screen.getByText("panel 2")).toBeInTheDocument();
});
