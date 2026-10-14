// @vitest-environment node
import type { ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { GET } from "@/app/api/u/[login]/card/route";

import { makePng } from "./lib/visuals/png-fixture";

const UID = "10f13b40-0000-4000-8000-000000000000";
let rendered: { element: ReactElement; options: { width: number; height: number; headers: Record<string, string> } } | null;

vi.mock("next/og", () => ({
  ImageResponse: class {
    constructor(element: ReactElement, options: { headers: Record<string, string> }) {
      rendered = { element, options } as never;
      return new Response("png", { headers: options.headers });
    }
  },
}));

type Result = Record<string, unknown>;
let results: Record<string, Result>;
let download: Result;
const calls: string[][] = [];
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from(table: string) {
      const builder: Record<string, unknown> = new Proxy(
        {},
        {
          get: (_, key) =>
            key === "then"
              ? (ok: (r: Result) => unknown) => ok(results[table]!)
              : (...args: unknown[]) => (calls.push([table, String(key), ...args.map((a) => JSON.stringify(a))]), builder),
        },
      );
      return builder;
    },
    storage: { from: (bucket: string) => ({ download: async (path: string) => (calls.push(["storage", bucket, path]), download) }) },
  }),
}));

const png = () => makePng();

const get = (login: string) => GET(new Request(`http://x/api/u/${login}/card`), { params: Promise.resolve({ login }) });
const html = () => renderToStaticMarkup(rendered!.element);

beforeEach(() => {
  rendered = null;
  calls.length = 0;
  results = {
    users: { data: { id: UID, github_login: "GuiBarradas", bytes: 1234, deleted_at: null }, error: null },
    rooms: { data: null, count: 3, error: null },
    forks: { data: null, count: 5, error: null },
  };
  download = { data: new Blob([png()]), error: null };
});

describe("GET /api/u/[login]/card", () => {
  it("renders the stored scene with server-read stats", async () => {
    const ok = await get("guibarradas");
    expect(ok.status).toBe(200);
    expect(ok.headers.get("cache-control")).toBe("no-store");
    expect(rendered!.options).toMatchObject({ width: 1200, height: 630 });
    const out = html();
    expect(out).toContain(`data:image/png;base64,${Buffer.from(png()).toString("base64")}`);
    expect(out).toContain("@GuiBarradas");
    expect(out).toContain("Bytes em saldo");
    expect(out).toContain("1.234");
    expect(out).toContain("Forks vivos");
    expect(out).toContain("Salas construídas");
    expect(out).not.toContain(UID);
    expect(calls).toContainEqual(["storage", "bunker-previews", `${UID}/scene.png`]);
    expect(calls).toContainEqual(["users", "select", '"id, github_login, bytes, deleted_at"']);
    expect(calls.some(([, m]) => ["insert", "update", "upsert", "delete", "rpc"].includes(m!))).toBe(false);
  });

  it("falls back to an honest no-preview card when the scene is missing", async () => {
    download = { data: null, error: { status: 404, statusCode: "NoSuchKey" } };
    expect((await get("GuiBarradas")).status).toBe(200);
    expect(html()).toContain("Seu bunker, sua identidade.");
    expect(html()).not.toContain("data:image/png");
  });

  it("falls back when the cached blob is not a valid preview", async () => {
    download = { data: new Blob(["not a png"]), error: null };
    expect((await get("GuiBarradas")).status).toBe(200);
    expect(html()).not.toContain("data:image/png");
  });

  it("falls back when a cached PNG is structurally plausible but its pixel stream is corrupt", async () => {
    download = { data: new Blob([makePng({ idat: new Uint8Array([0x78, 0x9c, 1, 2, 3]) })]), error: null };
    expect((await get("GuiBarradas")).status).toBe(200);
    expect(html()).toContain("Seu bunker, sua identidade.");
    expect(html()).not.toContain("data:image/png");
  });

  it("falls back when the bucket is missing", async () => {
    download = { data: null, error: { status: 400, statusCode: "BucketNotFound" } };
    expect((await get("GuiBarradas")).status).toBe(200);
    expect(html()).toContain("Seu bunker, sua identidade.");
  });

  it.each([
    ["unknown", { data: null, error: null }],
    ["deleted", { data: { id: UID, github_login: "x", bytes: 1, deleted_at: "2026-09-01T00:00:00Z" }, error: null }],
  ])("404s an %s user", async (_, users) => {
    results.users = users;
    expect((await get("GuiBarradas")).status).toBe(404);
    expect(rendered).toBeNull();
  });

  it("404s an invalid login without querying", async () => {
    expect((await get("a%25b")).status).toBe(404);
    expect(calls).toEqual([]);
  });

  it.each(["users", "rooms", "forks"])("503s when %s cannot be read instead of inventing zeros", async (table) => {
    results[table] = { data: null, count: null, error: new Error("db down") };
    expect((await get("GuiBarradas")).status).toBe(503);
    expect(rendered).toBeNull();
  });
});
