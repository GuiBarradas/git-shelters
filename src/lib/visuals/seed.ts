import { mulberry32 } from "@/lib/forks/catalog";
import type { VisualDomain } from "@/lib/visuals/types";

/** Recipe schema version. Never use it to reseed unrelated visual systems. */
export const GENERATOR_VERSION = 1;
const DOMAIN_VERSIONS: Record<VisualDomain, number> = { palette: 1, wear: 1, furniture: 1, resident: 1, signature: 1, room: 1, texture: 1 };

/** cyrb53: a small 53-bit string hash (bryc, public domain). */
export function cyrb53(str: string, seed = 0): number {
  let h1 = 0xdeadbeef ^ seed;
  let h2 = 0x41c6ce57 ^ seed;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507);
  h1 ^= Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507);
  h2 ^= Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return 4294967296 * (2097151 & h2) + (h1 >>> 0);
}

/**
 * The only identity the generator accepts: the account's numeric GitHub
 * user id, as a number or its canonical decimal string. Logins and repo
 * names never enter, so a rename cannot change a bunker. The seed only
 * drives looks; gameplay never reads it.
 */
export function canonicalGithubId(githubId: string | number): string {
  const n =
    typeof githubId === "number" ? githubId : typeof githubId === "string" && /^[1-9]\d*$/.test(githubId) ? Number(githubId) : NaN;
  if (!Number.isSafeInteger(n) || n <= 0) throw new RangeError(`invalid githubId: ${String(githubId)}`);
  return String(n);
}

export function identitySeed(githubId: string | number): number {
  return cyrb53(`github-user:${canonicalGithubId(githubId)}`);
}

/**
 * An independent stream per (id, domain version, domain, key). Each decision reads
 * its own stream, so adding a prop or a resident never shifts another's.
 */
export function createDomainRandom(githubId: string | number, domain: VisualDomain, key = ""): () => number {
  const h = cyrb53(`${identitySeed(githubId)}|${domain}|${DOMAIN_VERSIONS[domain]}|${key}`);
  return mulberry32((h % 4294967296) ^ Math.floor(h / 4294967296));
}

export function pick<T>(rand: () => number, items: readonly T[]): T {
  return items[Math.floor(rand() * items.length)]!;
}

export function pickWeighted<T>(roll: number, items: ReadonlyArray<readonly [T, number]>): T {
  const total = items.reduce((sum, [, w]) => sum + w, 0);
  let r = roll * total;
  for (const [item, w] of items) {
    if ((r -= w) < 0) return item;
  }
  return items[items.length - 1]![0];
}
