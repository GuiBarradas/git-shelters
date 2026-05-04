# Game design — Git Shelters

A short, public summary of the product thinking behind Git Shelters. The full design document is kept as an internal artifact; this file captures what is actually useful to anyone reading the public repo.

For decisions that span code (schema, RLS, routing, etc.), see the [ADR directory](./docs/adr/). For the running narrative of how the design evolved, see the [devlog drafts](./devlog/drafts/).

---

## Pitch

You are a **Maintainer** — one of the developers who survived *The Great Merge Conflict*, the day every public repository on the planet went into conflict at once. Hardware became scarce, agents went rogue, and the open internet collapsed into the **404 Lands**.

You build, defend, and grow your **Repo** — a bunker in the wreckage — using **Bytes**, the in-game currency. Bytes are minted by your **real GitHub activity**: each commit, PR, issue, and release you author becomes resources for your Repo. You recruit **Forks** (survivors), craft **Payload** (ammo), and hold off **Crawlers** (zombie bots) that roam the 404 Lands looking for cores to merge.

It is an idle / base-builder browser game where the act of *coding* is the act of *playing*.

## Pillars

1. **Coding is playing.** Real GitHub activity drives the economy. Not a side feature — the core mechanic.
2. **Cozy in the chaos.** Despite the apocalypse, the bunker is comforting. Soft music, charismatic survivors, terminals blinking green.
3. **Dry and absurd humor.** Naming, descriptions, events, and dialogue lean Fallout but keep the warmth of Minecraft Story Mode.
4. **Authored voxel aesthetics.** All visuals are generated from code. Disciplined palette, careful lighting. No asset flips.
5. **Honest progression.** A casual dev and a heavy committer both feel progress. Anti-cheese filters are designed in from day one.
6. **Emergent social.** Other bunkers exist, but interaction is never forced. Solo players play solo; social players have ways in.

## Core loop

1. Code something on GitHub (real life).
2. The game polls activity and credits Bytes — including a one-time backfill of the past 30 days at first connect.
3. Open the bunker. Spend Bytes on rooms, recruits, and crafting.
4. Resolve the day's event (a small narrative choice with two outcomes).
5. Close the tab. The world keeps running. Come back tomorrow.

The loop is short by design. The hook is that **what happens between sessions is not arbitrary** — it is shaped by what you actually did as a developer.

## In-world glossary

The naming is load-bearing. The world reads as satire only when the terms are used consistently.

| Real world | In-game term | Notes |
|---|---|---|
| Bunker | **Repo** | Each player has one. |
| Currency | **Bytes** | Earned from real GitHub activity. |
| Survivor | **Fork** | Forks have names, traits, and moods. |
| Player | **Maintainer** | You. |
| Zombie | **Crawler** | Subtypes: Dependabot, Linter, Test Runner, Stack Overflow, Infinite Loop. |
| Apocalypse | **The Great Merge Conflict** | The day it all fell apart. |
| Outside world | **404 Lands** | Fragmented, uncrawlable territory. |
| Cure | **Hot Fix** | Heals injured Forks. |
| Revive | **Rollback** | Brings back a dead Fork at high cost. |
| Enemy attack | **Force Push** | Crawlers attempt to overwrite your defenses. |

## Strategy: A → C

The project deliberately runs as **two sequential paths**, not one.

### Path A — the current focus

A dev-tool-shaped game. GitHub OAuth is required. Audience: developers active on GitHub.

The first public release is the **Public Alpha** — a deliberately small first artifact: GitHub login, a 3-room bunker, byte sync, offline catch-up, one default Home Region, a minimal Daily Event, and read-only public profile pages at `/u/<login>`. Everything else (combat, exploration, multiple regions, a social world map, LLM-generated events, trading) is explicitly cut from the Public Alpha and kept for later iterations.

The success criterion of Path A is **shipped, playable, postable**. Stars and engagement are bonuses; the engineering is the deliverable.

### Path C — a possible pivot, conditional

After v1.0 is public, a 30-day window measures real reception. Only if the numbers warrant it does the project consider Path C: a standalone idle game where GitHub becomes an optional power-up rather than a hard requirement. The audience expands from "developers" to "idle/cozy gamers + developers as a premium niche".

Path C is intentionally a **late, reversible decision**. Committing to it now would lock in 6+ months of work the data may not justify. Committing to A first costs nothing of optionality.

### What this means in the code

To keep Path C cheap to enter later, the architecture separates:

- **The source of Bytes** (GitHub events) from **the act of crediting Bytes** (a pure function over `(last_seen_at, now, rates)`).
- **Auth** from **gameplay state** — the schema does not assume the player has a GitHub identity.
- **Content** (events, rooms, recipes) from **triggers** — events can be triggered by GitHub today and by other sources tomorrow.

These are small upfront costs that buy a meaningful option later.

## Where to read more

- [ADRs](./docs/adr/) — concrete architectural decisions with their alternatives.
- [Devlog drafts](./devlog/drafts/) — long-form posts in progress, weekly cadence once published.
- [README](./README.md) — what this repo demonstrates and how to run it.
