// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

import { POST } from "@/app/api/bunker-card/route";

import { makePng } from "./lib/visuals/png-fixture";

const UID = "10f13b40-0000-4000-8000-000000000000";
const getUser = vi.fn();
const upload = vi.fn();
let profile: { data: unknown; error: unknown };

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser },
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => profile }) }) }),
    storage: { from: (bucket: string) => ({ upload: (...args: unknown[]) => upload(bucket, ...args) }) },
  }),
}));

const png = (width = 960, height = 720) => makePng({ width, height });

const post = (body: BodyInit | null, headers: Record<string, string> = {}, url = "http://app.test/api/bunker-card") =>
  POST(
    new Request(url, {
      method: "POST",
      body,
      headers: { "content-type": "image/png", ...headers },
      duplex: "half",
    } as RequestInit),
  );

beforeEach(() => {
  getUser.mockReset().mockResolvedValue({ data: { user: { id: UID } } });
  upload.mockReset().mockResolvedValue({ data: { path: `${UID}/scene.png` }, error: null });
  profile = { data: { github_login: "GuiBarradas", github_id: 87228787, deleted_at: null }, error: null };
});

describe("POST /api/bunker-card", () => {
  it("stores the owner's PNG at the fixed path, ignoring client-supplied paths", async () => {
    const res = await post(png(), { origin: "http://app.test" }, "http://app.test/api/bunker-card?path=other/scene.png");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, url: "/api/u/GuiBarradas/card" });
    expect(upload).toHaveBeenCalledOnce();
    const [bucket, path, bytes, opts] = upload.mock.calls[0]!;
    expect([bucket, path]).toEqual(["bunker-previews", `${UID}/scene.png`]);
    expect(bytes).toEqual(png());
    expect(opts).toEqual({ upsert: true, contentType: "image/png", cacheControl: "0" });
  });

  it("rejects anonymous callers", async () => {
    getUser.mockResolvedValue({ data: { user: null } });
    expect((await post(png())).status).toBe(401);
  });

  it.each([
    ["deleted", { github_login: "a", github_id: 1, deleted_at: "2026-09-01T00:00:00Z" }],
    ["missing", null],
    ["placeholder github id", { github_login: "a", github_id: 0, deleted_at: null }],
    ["invalid login", { github_login: "bad login", github_id: 1, deleted_at: null }],
  ])("rejects a %s profile", async (_, row) => {
    profile = { data: row, error: null };
    expect((await post(png())).status).toBe(403);
  });

  it("rejects a foreign origin", async () => {
    expect((await post(png(), { origin: "https://evil.test" })).status).toBe(403);
  });

  it("requires raw image/png", async () => {
    expect((await post(png(), { "content-type": "application/json" })).status).toBe(415);
    expect((await post(png(), { "content-type": "multipart/form-data; boundary=x" })).status).toBe(415);
  });

  it.each([
    ["not a PNG", new TextEncoder().encode("hello")],
    ["wrong dimensions", png(1200, 630)],
    ["corrupt pixel data", makePng({ idat: new Uint8Array([0x78, 0x9c, 1, 2, 3]) })],
  ])("rejects %s", async (_, body) => {
    expect((await post(body)).status).toBe(422);
    expect(upload).not.toHaveBeenCalled();
  });

  it("rejects an oversize declared body", async () => {
    expect((await post(png(), { "content-length": String(3 * 1024 * 1024 + 1) })).status).toBe(413);
  });

  it("rejects an oversize streamed body without Content-Length", async () => {
    const stream = new ReadableStream<Uint8Array>({
      start(c) {
        for (let i = 0; i < 4; i++) c.enqueue(new Uint8Array(1024 * 1024));
        c.close();
      },
    });
    expect((await post(stream)).status).toBe(413);
    expect(upload).not.toHaveBeenCalled();
  });

  it("reports storage failures as unavailable without leaking details", async () => {
    upload.mockResolvedValue({ data: null, error: { message: "secret bucket detail", status: 500 } });
    const res = await post(png());
    expect(res.status).toBe(503);
    expect(await res.text()).not.toContain("secret");
  });

  it("reports a profile query failure as unavailable", async () => {
    profile = { data: null, error: new Error("db down") };
    expect((await post(png())).status).toBe(503);
  });
});
