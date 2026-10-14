import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AccountMenu } from "@/components/hud/AccountMenu";

vi.mock("@/app/auth/actions", () => ({ signOut: vi.fn() }));
vi.stubGlobal("React", React);

beforeEach(() => {
  localStorage.clear();
  // jsdom has no matchMedia; the quality default asks it about touch screens.
  window.matchMedia = (() => ({ matches: false })) as unknown as typeof window.matchMedia;
});
afterEach(cleanup);

const open = () => {
  fireEvent.click(screen.getByRole("button", { name: "Account" }));
  return screen.getByRole("region", { name: "Account" });
};

describe("account menu", () => {
  it("opens with the player's links and moves focus into it", () => {
    render(<AccountMenu login="GuiBarradas" />);
    const trigger = screen.getByRole("button", { name: "Account" });
    expect(trigger).toHaveTextContent("GB");
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    open();
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("link", { name: /Public Repo/ })).toHaveAttribute("href", "/u/GuiBarradas");
    expect(screen.getByRole("link", { name: /Public Repo/ })).toHaveFocus();
    expect(screen.getByRole("link", { name: /Intro \/ credits/ })).toHaveAttribute("href", "/?intro=1");
    expect(screen.getByRole("link", { name: "Settings" })).toHaveAttribute("href", "/settings");
    expect(screen.getByRole("link", { name: "Privacy" })).toHaveAttribute("href", "/legal/privacy");
    expect(screen.getByRole("link", { name: "Terms" })).toHaveAttribute("href", "/legal/terms");
    expect(screen.getByRole("button", { name: "Log out" }).closest("form")).not.toBeNull();
  });

  it("closes on Escape and returns focus to the avatar", () => {
    render(<AccountMenu login="GuiBarradas" />);
    open();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("region", { name: "Account" })).toBeNull();
    expect(screen.getByRole("button", { name: "Account" })).toHaveFocus();
  });

  it("closes on a click outside but not on one inside", () => {
    render(<><AccountMenu login="GuiBarradas" /><p>scene</p></>);
    const panel = open();
    fireEvent.pointerDown(panel);
    expect(screen.getByRole("region", { name: "Account" })).toBeInTheDocument();
    fireEvent.pointerDown(screen.getByText("scene"));
    expect(screen.queryByRole("region", { name: "Account" })).toBeNull();
  });

  it("stores the visual quality and announces it like the floating picker did", () => {
    const changed = vi.fn();
    window.addEventListener("shelter-quality", changed);
    render(<AccountMenu login="GuiBarradas" />);
    open();
    expect(screen.getByRole("radio", { name: "medium" })).toBeChecked();
    fireEvent.click(screen.getByRole("radio", { name: "high" }));
    expect(localStorage.getItem("shelter-quality")).toBe("high");
    expect(changed).toHaveBeenCalledOnce();
    expect(screen.getByRole("radio", { name: "high" })).toBeChecked();
    window.removeEventListener("shelter-quality", changed);
  });
});
