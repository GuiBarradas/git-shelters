// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

import { GET } from "@/app/api/u/[login]/card/route";

import { makePng } from "./lib/visuals/png-fixture";

// Real next/og renderer (Satori + resvg, bundled font): only the data layer is faked.
const UID = "10f13b40-0000-4000-8000-000000000000";
let login: string;
let scene: Uint8Array<ArrayBuffer> | null;

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from(table: string) {
      const result =
        table === "users"
          ? { data: { id: UID, github_login: login, bytes: 9_007_199_254_740_991, deleted_at: null }, error: null }
          : { data: null, count: 12, error: null };
      const builder: Record<string, unknown> = new Proxy(
        {},
        { get: (_, key) => (key === "then" ? (ok: (r: unknown) => unknown) => ok(result) : () => builder) },
      );
      return builder;
    },
    storage: {
      from: () => ({
        download: async () => (scene ? { data: new Blob([scene]), error: null } : { data: null, error: { statusCode: 404 } }),
      }),
    },
  }),
}));

async function render() {
  const res = await GET(new Request(`http://x/api/u/${login}/card`), { params: Promise.resolve({ login }) });
  expect(res.status).toBe(200);
  const body = new Uint8Array(await res.arrayBuffer());
  const view = new DataView(body.buffer);
  return { body, width: view.getUint32(16), height: view.getUint32(20) };
}

beforeEach(() => {
  login = "a".repeat(39);
  scene = makePng();
});

describe("share card real render", () => {
  it("renders a 1200x630 PNG with a stored scene and a 39-char login", async () => {
    const { body, width, height } = await render();
    expect([...body.subarray(0, 8)]).toEqual([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    expect([width, height]).toEqual([1200, 630]);
  }, 30_000);

  it("renders the fallback card when no scene is stored", async () => {
    scene = null;
    login = "GuiBarradas";
    const { body, width, height } = await render();
    expect(body.byteLength).toBeGreaterThan(1000);
    expect([width, height]).toEqual([1200, 630]);
  }, 30_000);
});
