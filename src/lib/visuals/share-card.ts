import { inflateSync } from "node:zlib";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/lib/supabase/database.types";

/**
 * Bunker scene previews: one private PNG per account, written by the owner
 * (RLS) and read back only by the public share-card route. Server-only.
 */

export const PREVIEW_BUCKET = "bunker-previews";
export const PREVIEW_WIDTH = 960;
export const PREVIEW_HEIGHT = 720;
export const MAX_IMAGE_BYTES = 3 * 1024 * 1024;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The only object path a preview can live at; the policy in the migration pins the same name. */
export function previewPath(userId: string): string {
  if (!UUID.test(userId)) throw new RangeError("invalid user id");
  return `${userId.toLowerCase()}/scene.png`;
}

/**
 * Reads the body without trusting Content-Length: a declared size over the
 * limit is refused up front, and the stream is cancelled as soon as the
 * running total crosses it. Returns null when the body is too large.
 */
export async function readBoundedBody(request: Request, max = MAX_IMAGE_BYTES): Promise<Uint8Array | null> {
  const declared = request.headers.get("content-length");
  if (declared !== null && !(Number(declared) <= max)) return null;
  if (!request.body) return new Uint8Array(0);

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > max) {
      await reader.cancel().catch(() => {});
      return null;
    }
    chunks.push(value);
  }
  const out = new Uint8Array(total);
  let at = 0;
  for (const c of chunks) {
    out.set(c, at);
    at += c.byteLength;
  }
  return out;
}

const SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
/** Bytes per pixel for what a browser canvas emits: 8-bit RGB (2) or RGBA (6). */
const CHANNELS: Record<number, number> = { 2: 3, 6: 4 };

const CRC_TABLE = new Uint32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c;
});

function crc32(bytes: Uint8Array): number {
  let c = ~0;
  for (const b of bytes) c = CRC_TABLE[(c ^ b) & 0xff]! ^ (c >>> 8);
  return ~c >>> 0;
}

const isLetter = (b: number) => (b >= 65 && b <= 90) || (b >= 97 && b <= 122);

/** Only fixed-size, uncompressed metadata for our sRGB Canvas export is accepted. */
function isCanvasMetadata(name: string, data: Uint8Array): boolean {
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  switch (name) {
    case "sRGB": return data.length === 1 && data[0]! <= 3;
    case "gAMA": return data.length === 4 && view.getUint32(0) === 45455;
    case "cHRM": {
      const srgb = [31270, 32900, 64000, 33000, 30000, 60000, 15000, 6000];
      return data.length === 32 && srgb.every((v, i) => view.getUint32(i * 4) === v);
    }
    case "cICP": return data.length === 4 && [1, 13, 0, 1].every((v, i) => data[i] === v);
    case "pHYs": return data.length === 9 && view.getUint32(0) > 0 && view.getUint32(4) > 0 && data[8]! <= 1;
    default: return false; // Includes compressed ICC/text, EXIF, animation, and unknown extensions.
  }
}

/**
 * Validates (does not decode) a canvas-style PNG: 8-bit RGB/RGBA at the
 * expected size, non-interlaced; every chunk CRC-checked; IHDR first, one
 * contiguous IDAT run, IEND last, only fixed sRGB metadata before pixels. The IDAT stream
 * must inflate to exactly one filtered scanline per row (filter 0..4), so a
 * stored object the renderer would choke on is refused up front.
 */
export function isPreviewPng(bytes: Uint8Array, width = PREVIEW_WIDTH, height = PREVIEW_HEIGHT): boolean {
  if (bytes.byteLength > MAX_IMAGE_BYTES || bytes.byteLength < 8 + 25 + 12) return false;
  if (SIGNATURE.some((b, i) => bytes[i] !== b)) return false;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);

  let channels = 0;
  const idat: Uint8Array[] = [];
  const metadata = new Set<string>();
  for (let at = 8; at + 12 <= bytes.byteLength; ) {
    const length = view.getUint32(at);
    const end = at + 12 + length;
    if (end > bytes.byteLength) return false;
    const type = bytes.subarray(at + 4, at + 8);
    if (!type.every(isLetter) || view.getUint32(end - 4) !== crc32(bytes.subarray(at + 4, end - 4))) return false;
    const name = String.fromCharCode(...type);
    const data = bytes.subarray(at + 8, end - 4);

    if (!channels) {
      if (name !== "IHDR" || length !== 13) return false;
      if (view.getUint32(at + 8) !== width || view.getUint32(at + 12) !== height) return false;
      const [depth, color, compression, filter, interlace] = data.subarray(8);
      channels = CHANNELS[color!] ?? 0;
      if (!channels || depth !== 8 || compression !== 0 || filter !== 0 || interlace !== 0) return false;
    } else if (name === "IDAT") {
      idat.push(data);
    } else if (name === "IEND") {
      return length === 0 && end === bytes.byteLength && idat.length > 0 && inflatesToScanlines(idat, width * channels, height);
    } else {
      if (idat.length || metadata.has(name) || !isCanvasMetadata(name, data)) return false;
      metadata.add(name);
    }
    at = end;
  }
  return false;
}

/** Inflates the IDAT run capped at the exact expected size and checks every row's filter byte. */
function inflatesToScanlines(idat: Uint8Array[], rowBytes: number, height: number): boolean {
  const expected = (rowBytes + 1) * height;
  let raw: Buffer;
  try {
    raw = inflateSync(Buffer.concat(idat), { maxOutputLength: expected });
  } catch {
    return false; // corrupt, truncated, or longer than the declared image
  }
  if (raw.byteLength !== expected) return false;
  for (let row = 0; row < expected; row += rowBytes + 1) if (raw[row]! > 4) return false;
  return true;
}

const NOT_FOUND_CODES = new Set(["BucketNotFound", "NoSuchBucket", "NoSuchKey", "ObjectNotFound", "not_found"]);

/** True only for a Storage error that positively says the bucket or object is missing. */
export function isStorageNotFound(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const { status, statusCode, code } = error as { status?: unknown; statusCode?: unknown; code?: unknown };
  const is404 = (v: unknown) => v === 404 || v === "404";
  const isCode = (v: unknown) => typeof v === "string" && NOT_FOUND_CODES.has(v);
  return is404(status) || is404(statusCode) || isCode(statusCode) || isCode(code);
}

type Admin = SupabaseClient<Database>;

/**
 * The owner's preview, or null when it is missing, unreadable, too large
 * or not a valid preview PNG. Never throws: the card falls back instead.
 */
export async function downloadPreview(admin: Admin, userId: string): Promise<Uint8Array | null> {
  try {
    // This one path is overwritten by the owner; bypass both Next fetch and Storage CDN caches.
    const { data, error } = await admin.storage.from(PREVIEW_BUCKET).download(
      previewPath(userId), { cacheNonce: String(Date.now()) }, { cache: "no-store" },
    );
    if (error) {
      if (!isStorageNotFound(error)) console.warn("bunker preview download failed", (error as { status?: unknown }).status);
      return null;
    }
    // ponytail: the SDK buffers the blob before this check; the bucket's 3 MB file_size_limit is the real cap.
    if (!data || data.size > MAX_IMAGE_BYTES) return null;
    const bytes = new Uint8Array(await data.arrayBuffer());
    return isPreviewPng(bytes) ? bytes : null;
  } catch {
    console.warn("bunker preview download failed");
    return null;
  }
}

/** Deletes exactly the owner's preview. A missing bucket/object is fine; any other failure throws. */
export async function removePreview(admin: Admin, userId: string): Promise<void> {
  const { error } = await admin.storage.from(PREVIEW_BUCKET).remove([previewPath(userId)]);
  if (error && !isStorageNotFound(error)) throw error;
}
