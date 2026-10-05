# Game design — Git Shelters

A short, public summary of the product thinking behind Git Shelters. The full design document is kept as an internal artifact; this file captures what is actually useful to anyone reading the public repo.

For decisions that span code (schema, RLS, routing, etc.), see the [ADR directory](./docs/adr/). For the running narrative of how the design evolved, see the [devlog drafts](./devlog/drafts/).

---

## Pitch

You are a **Maintainer** — one of the developers who survived *The Great Merge Conflict*, the day every public repository on the planet went into conflict at once. Hardware became scarce, agents went rogue, and the open internet collapsed into the **404 Lands**.

You build and grow your **Repo** — a bunker in the wreckage — using **Bytes**, the in-game currency. In the Alpha, public GitHub pushes earn Bytes; daily events and the welcome packet also provide them. You recruit **Forks** (survivors) and assign them to rooms that produce food, power and **Payload**. Combat against **Crawlers** is planned; Payload has no combat use yet.

It is an idle / base-builder browser game where the act of *coding* is the act of *playing*.

## Pillars

1. **Coding is playing.** Real GitHub activity drives the economy. Not a side feature — the core mechanic.
2. **Cozy in the chaos.** Despite the apocalypse, the bunker is comforting. Music, charismatic survivors, violet terminals and amber lamps.
3. **Dry and absurd humor.** Naming, descriptions, events, and dialogue lean Fallout but keep the warmth of Minecraft Story Mode.
4. **Authored voxel aesthetics.** All visuals are generated from code. Disciplined palette, careful lighting. No asset flips.
5. **Honest progression.** A casual dev and a heavy committer both feel progress. Anti-cheese filters are designed in from day one.
6. **Emergent social.** Other bunkers exist, but interaction is never forced. Solo players play solo; social players have ways in.

## Core loop

1. Code something on GitHub (real life).
2. The game polls activity and credits Bytes — including a one-time backfill of the past 30 days at first connect.
3. Open the bunker. Spend Bytes on rooms and recruits; assign Forks to produce resources.
4. Resolve the day's event (a small narrative choice with two outcomes).
5. Close the tab. The world keeps running. Come back tomorrow.

The loop is short by design. The hook is that **what happens between sessions is not arbitrary** — it is shaped by what you actually did as a developer.

## In-world glossary

The glossary includes planned systems; it is not a list of implemented features.

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

The **Public Alpha is live**. It includes GitHub login, byte sync, offline resources, a two-floor bunker with an elevator, Forks and jobs, daily events, badges, music, an intro, read-only profiles and a 2D map of the 404 Lands. The Outage is the only open region. Combat, expeditions, other playable regions, LLM-generated events, trading and kudos remain future work.

### Delivery status — 5 October 2026

- **Shipped baseline:** the Alpha systems above, welcome packets, account export/deletion and server-side analytics, recorded in September.
- **October update:** guided first steps, prominent welcome collection, worker guidance, next-event countdown, an eight-hour resource forecast and the offline blackout fix. Changes pushed to `main`; the maintainer confirmed the flow tested and validated on 5 October 2026 after the push through `272403a`.
- **Recruitment balance:** every additional Fork costs 200 B; the starter remains free.
- **Alpha fixes:** initial sync status and retry feedback, visible-time analytics across tab changes/navigation, and separate intro start/completed/skipped milestones. Verify analytics collection separately; visible segments are not whole sessions.
- **Next steps:** collect player feedback and compare activation and repeat daily events after the onboarding and recruitment changes.
- **Sync verified (5 October):** Actions run `37268641673` synced all 15 bunkers with zero failures; database timestamps and recent GitHub credits corroborate successful sync. History audit: 70 scheduled runs from 22 September to 5 October, all successful; mean gap 4h21, range 2h11–7h32, despite a 15-minute schedule. Runs finish within 61 seconds once created. Evidence points to delayed/missing schedule delivery before run creation; GitHub does not expose the internal cause. Migration to Supabase Cron is explicitly deferred by the maintainer (5 October); keep the current Actions schedule.
- **Verified (5 October):** CI run `37268556721` passed quality/build and anonymous Playwright checks for `272403a`. Production analytics contains 10 new visible segments in the inspected window; intro events still need an observed sample.
- **Performance baseline:** simulated 4G (1.6 Mbps down, 0.75 Mbps up, 150 ms, CPU 4x), Chromium 147 headless at 390x844: LCP 5.908 / 1.636 / 1.588 s; canvas visible after 17.021 / 10.161 / 10.012 s. Run `node scripts/measure-landing.mjs`. The consistent sub-3-second target remains open. The refined scene passed a local production check on Intel Iris Xe: ten rooms, twelve Forks, ~60 fps over 600 frames with adaptive resolution; see [the art guide](docs/art-guide.md) for conditions and limits.
- **Verification still needed:** Sentry issues (API returned 403 with the configured token), intro analytics, OAuth revocation/re-entry and account export/deletion. Flow validation does not establish these separate checks.
- **Later:** branching events, combat/exploration, additional regions and social systems. Anonymous playable mode is conditional future work; today's landing demo is visual only.

The success criterion of Path A is **shipped, playable, postable**. Stars and engagement are bonuses; the engineering is the deliverable.

### Path C — a possible pivot, conditional

After v1.0 is public, a 30-day window measures real reception. Only if the numbers warrant it does the project consider Path C: a standalone idle game where GitHub becomes an optional power-up rather than a hard requirement. The audience expands from "developers" to "idle/cozy gamers + developers as a premium niche".

Path C is intentionally a **late, reversible decision**. Committing to it now would lock in 6+ months of work the data may not justify. Committing to A first costs nothing of optionality.

### What this means in the code

To keep Path C cheap to enter later, the architecture separates:

- **The source of Bytes** from **crediting Bytes** — the ledger accepts distinct sources and deduplicates credits.
- **Resource simulation** from **persistence** — a pure function calculates offline resources; the server applies the result.
- **Content** from **triggers** — event text and room catalogs can be reused with future entry points.

GitHub authentication is still required for actual play. Anonymous auth and the necessary account/schema changes are not implemented yet.

These are small upfront costs that buy a meaningful option later.

## Where to read more

- [ADRs](./docs/adr/) — concrete architectural decisions with their alternatives.
- [Devlog drafts](./devlog/drafts/) — long-form posts in progress, weekly cadence once published.
- [README](./README.md) — what this repo demonstrates and how to run it.
