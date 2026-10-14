// @vitest-environment node
import { deflateSync } from "node:zlib";

import { describe, expect, it, vi } from "vitest";

import {
  downloadPreview,
  isPreviewPng,
  isStorageNotFound,
  MAX_IMAGE_BYTES,
  previewPath,
  readBoundedBody,
} from "@/lib/visuals/share-card";

import { chunk, makePng, type PngOptions } from "./png-fixture";

const UID = "10f13b40-0000-4000-8000-000000000000";

// Small images keep the table fast; the validator takes the expected size.
const W = 4;
const H = 3;
const png = (o: PngOptions = {}) => makePng({ width: W, height: H, ...o });
const valid = (bytes: Uint8Array) => isPreviewPng(bytes, W, H);
const concat = (...parts: Uint8Array[]) => new Uint8Array(parts.flatMap((p) => [...p]));

describe("isPreviewPng", () => {
  it("accepts genuine 8-bit RGB and RGBA PNGs, with ancillary chunks", () => {
    expect(valid(png())).toBe(true);
    expect(valid(png({ color: 2 }))).toBe(true);
    expect(valid(png({ filter: 4 }))).toBe(true);
    expect(valid(png({ before: [chunk("sRGB", new Uint8Array([0]))] }))).toBe(true);
    expect(isPreviewPng(makePng())).toBe(true); // the real 960x720 default
  });

  it("accepts only the bounded sRGB and resolution metadata emitted by Canvas", () => {
    const words = (...values: number[]) => {
      const data = new Uint8Array(values.length * 4);
      values.forEach((v, i) => new DataView(data.buffer).setUint32(i * 4, v));
      return data;
    };
    expect(valid(png({ before: [
      chunk("sRGB", new Uint8Array([0])),
      chunk("gAMA", words(45455)),
      chunk("cHRM", words(31270, 32900, 64000, 33000, 30000, 60000, 15000, 6000)),
      chunk("cICP", new Uint8Array([1, 13, 0, 1])),
      chunk("pHYs", concat(words(3780, 3780), new Uint8Array([1]))),
    ] }))).toBe(true);
  });

  it.each(["iCCP", "zTXt", "iTXt", "tEXt", "eXIf", "acTL", "vpAg"])(
    "rejects %s even with a valid CRC and compressed payload", (name) => {
      expect(valid(png({ before: [chunk(name, deflateSync(new Uint8Array(1024))) ] }))).toBe(false);
    },
  );

  it("rejects malformed, duplicate, or non-sRGB metadata", () => {
    for (const before of [
      [chunk("sRGB", new Uint8Array([4]))],
      [chunk("sRGB", new Uint8Array([0, 0]))],
      [chunk("sRGB", new Uint8Array([0])), chunk("sRGB", new Uint8Array([0]))],
      [chunk("gAMA", new Uint8Array(4))],
      [chunk("cICP", new Uint8Array([9, 16, 0, 1]))],
      [chunk("pHYs", new Uint8Array(9))],
    ]) expect(valid(png({ before }))).toBe(false);
  });

  it("rejects a corrupt CRC, including on IHDR", () => {
    const idatCrc = png();
    idatCrc[idatCrc.length - 12 - 1]! ^= 1; // last CRC byte before IEND
    expect(valid(idatCrc)).toBe(false);
    const ihdrCrc = png();
    ihdrCrc[8 + 25 - 1]! ^= 1;
    expect(valid(ihdrCrc)).toBe(false);
  });

  it.each([
    ["wrong width", png({ width: W + 1 })],
    ["wrong height", png({ height: H + 1 })],
    ["16-bit depth", png({ depth: 16 })],
    ["palette color", png({ color: 3 })],
    ["grayscale", png({ color: 0 })],
    ["interlaced", png({ interlace: 1 })],
    ["corrupt IDAT with a valid CRC", png({ idat: new Uint8Array([0x78, 0x9c, 1, 2, 3, 4, 5]) })],
    ["empty IDAT", png({ idat: new Uint8Array(0) })],
    ["truncated zlib stream", png({ idat: deflateSync(new Uint8Array((W * 4 + 1) * H)).subarray(0, 6) })],
    ["inflates past the declared size", png({ raw: new Uint8Array((W * 4 + 1) * H + 1) })],
    ["inflates short of the declared size", png({ raw: new Uint8Array((W * 4 + 1) * H - 1) })],
    ["invalid scanline filter", png({ filter: 5 })],
    ["unknown critical chunk", png({ before: [chunk("ABCD", new Uint8Array(1))] })],
    ["a PLTE chunk", png({ before: [chunk("PLTE", new Uint8Array(3))] })],
    ["a second IHDR", png({ before: [png().subarray(8, 33)] })],
    ["bytes after IEND", concat(png(), new Uint8Array([0]))],
    ["missing IEND", png().subarray(0, -12)],
    ["only the first 24 bytes", png().subarray(0, 24)],
    ["truncated chunk", png().subarray(0, 40)],
    ["bad signature", concat(new Uint8Array([0]), png().subarray(1))],
  ])("rejects %s", (_, bytes) => {
    expect(valid(bytes)).toBe(false);
  });

  it("rejects split IDATs separated by another chunk", () => {
    const deflated = deflateSync(new Uint8Array((W * 4 + 1) * H));
    const bytes = png({ idat: deflated.subarray(0, 4) });
    const iend = bytes.length - 12;
    const split = concat(bytes.subarray(0, iend), chunk("tEXt", new Uint8Array([65, 0, 66])), chunk("IDAT", deflated.subarray(4)), bytes.subarray(iend));
    expect(valid(split)).toBe(false);
  });

  it("rejects input over the size cap", () => {
    expect(isPreviewPng(new Uint8Array(MAX_IMAGE_BYTES + 1))).toBe(false);
  });
});

describe("readBoundedBody", () => {
  const streamOf = (sizes: number[]) =>
    new ReadableStream<Uint8Array>({
      start(c) {
        for (const s of sizes) c.enqueue(new Uint8Array(s));
        c.close();
      },
    });

  it("reads a body under the limit", async () => {
    const body = await readBoundedBody(new Request("http://x", { method: "POST", body: new Uint8Array(10) }), 16);
    expect(body?.byteLength).toBe(10);
  });

  it("refuses a declared oversize body without reading it", async () => {
    const req = new Request("http://x", { method: "POST", body: "x", headers: { "content-length": String(MAX_IMAGE_BYTES + 1) } });
    expect(await readBoundedBody(req)).toBeNull();
  });

  it("stops a streamed body with no Content-Length once it crosses the limit", async () => {
    const req = new Request("http://x", { method: "POST", body: streamOf([8, 8, 8]), duplex: "half" } as RequestInit);
    expect(req.headers.get("content-length")).toBeNull();
    expect(await readBoundedBody(req, 16)).toBeNull();
  });
});

describe("previewPath", () => {
  it("is fixed per owner", () => expect(previewPath(UID)).toBe(`${UID}/scene.png`));
  it.each(["../x", "", `${UID}/../other`, "a/b"])("rejects %j", (id) => expect(() => previewPath(id)).toThrow());
});

describe("isStorageNotFound", () => {
  it.each([
    { status: 404 },
    { status: "404" },
    { statusCode: 404 },
    { statusCode: "404" },
    { statusCode: "NoSuchKey" },
    { status: 400, statusCode: "BucketNotFound" },
    { code: "NoSuchBucket" },
    { code: "ObjectNotFound" },
    { code: "not_found" },
  ])("matches %j", (e) => expect(isStorageNotFound(e)).toBe(true));
  it.each([
    null,
    new Error("boom"),
    { message: "object not found" },
    { status: 400 },
    { status: 500, statusCode: "500" },
    { statusCode: 500, code: "AccessDenied" },
    { status: 403, statusCode: "403" },
  ])("does not match %j", (e) => expect(isStorageNotFound(e)).toBe(false));
});

describe("downloadPreview", () => {
  const adminWith = (result: unknown) => ({ storage: { from: () => ({ download: async () => result }) } }) as never;

  it("returns a valid stored preview", async () => {
    const bytes = await downloadPreview(adminWith({ data: new Blob([makePng()]), error: null }), UID);
    expect(bytes && isPreviewPng(bytes)).toBe(true);
  });

  it("bypasses fetch and object caches when reading an overwritten preview", async () => {
    const download = vi.fn(async () => ({ data: new Blob([makePng()]), error: null }));
    const admin = { storage: { from: () => ({ download }) } } as never;
    await downloadPreview(admin, UID);
    expect(download).toHaveBeenCalledWith(
      `${UID}/scene.png`, { cacheNonce: expect.stringMatching(/^\d+$/) }, { cache: "no-store" },
    );
  });

  it("falls back on a missing object, a corrupt blob, or a thrown error", async () => {
    expect(await downloadPreview(adminWith({ data: null, error: { status: 404, statusCode: "404" } }), UID)).toBeNull();
    expect(await downloadPreview(adminWith({ data: new Blob(["nope"]), error: null }), UID)).toBeNull();
    const throwing = { storage: { from: () => ({ download: async () => Promise.reject(new Error("net")) }) } } as never;
    expect(await downloadPreview(throwing, UID)).toBeNull();
  });
});
