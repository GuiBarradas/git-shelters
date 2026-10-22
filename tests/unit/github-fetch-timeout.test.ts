import { afterEach, expect, it, vi } from "vitest";
import { fetchUserEvents } from "@/lib/github/events";

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

it("bounds GitHub requests and propagates timeout instead of returning empty activity", async () => {
  const controller = new AbortController();
  const timeout = vi.spyOn(AbortSignal, "timeout").mockReturnValue(controller.signal);
  const fetch = vi.fn((_url: unknown, options: RequestInit) => new Promise<Response>((_resolve, reject) => {
    options.signal!.addEventListener("abort", () => reject(options.signal!.reason));
  }));
  vi.stubGlobal("fetch", fetch);
  const pending = fetchUserEvents("some-user");
  const rejected = expect(pending).rejects.toThrow("GitHub timeout");
  controller.abort(new Error("GitHub timeout"));
  await rejected;
  expect(timeout).toHaveBeenCalledWith(10_000);
});
