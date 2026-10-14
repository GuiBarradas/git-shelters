import { deflateSync } from "node:zlib";

/** Independent of the validator's table so a shared bug can't hide. */
function crc32(bytes: Uint8Array): number {
  let c = ~0;
  for (const b of bytes) {
    c ^= b;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  return ~c >>> 0;
}

/** One PNG chunk with a correct CRC. */
export function chunk(type: string, data: Uint8Array = new Uint8Array(0)): Uint8Array<ArrayBuffer> {
  const out = new Uint8Array(12 + data.length);
  const view = new DataView(out.buffer);
  view.setUint32(0, data.length);
  out.set([...type].map((c) => c.charCodeAt(0)), 4);
  out.set(data, 8);
  view.setUint32(8 + data.length, crc32(out.subarray(4, 8 + data.length)));
  return out;
}

export type PngOptions = {
  width?: number;
  height?: number;
  color?: number;
  depth?: number;
  interlace?: number;
  /** Filter byte written at the start of every scanline. */
  filter?: number;
  /** Raw (pre-deflate) scanline bytes; defaults to blank rows sized from the header. */
  raw?: Uint8Array;
  /** IDAT payload as-is, skipping deflate. */
  idat?: Uint8Array;
  /** Chunks inserted between IHDR and IDAT. */
  before?: Uint8Array[];
};

/** A genuine, decodable PNG (defaults: 960x720 8-bit RGBA, blank pixels). */
export function makePng({
  width = 960,
  height = 720,
  color = 6,
  depth = 8,
  interlace = 0,
  filter = 0,
  raw,
  idat,
  before = [],
}: PngOptions = {}): Uint8Array<ArrayBuffer> {
  const ihdr = new Uint8Array(13);
  const view = new DataView(ihdr.buffer);
  view.setUint32(0, width);
  view.setUint32(4, height);
  ihdr.set([depth, color, 0, 0, interlace], 8);

  const stride = width * (color === 2 ? 3 : 4) + 1;
  if (!raw) {
    raw = new Uint8Array(stride * height);
    for (let row = 0; row < raw.length; row += stride) raw[row] = filter;
  }
  const parts = [
    new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    ...before,
    chunk("IDAT", idat ?? deflateSync(raw)),
    chunk("IEND"),
  ];
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let at = 0;
  for (const p of parts) {
    out.set(p, at);
    at += p.length;
  }
  return out;
}
