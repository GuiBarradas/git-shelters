# Contributing to Git Shelters

Thanks for looking. This is a one-person game in public alpha; the bar for a contribution is "it makes the bunker better and it does not break the ledger". Small is welcome. A single new line for a Fork is a real contribution.

## Before you start

- Read the [README](./README.md) for the setup and the map of the code.
- Read the [art guide](./docs/art-guide.md) before touching anything visual.
- Skim [docs/adr/](./docs/adr/). If your change disagrees with an accepted decision, open an issue first; the ADR may be wrong, but it should be changed on purpose.
- Content (names, texts, art) is not under the AGPL; see [ADR 0009](./docs/adr/0009-license-agpl-code-reserved-content.md). By contributing content you agree it joins the game under the same terms as the rest.

## Setup

```bash
pnpm install
cp .env.local.example .env.local   # fill in your own Supabase project
pnpm db:push && pnpm db:types
pnpm dev
```

Use your own Supabase project. Never point tests at a real player's account; integration tests create a throwaway user each run (`tests/integration/fixture.ts`) and delete it afterwards.

## The rules that matter

1. **Bytes only move through the ledger.** Credits and debits go through `credit_bytes_tx` with a `(source, source_ref)` pair that makes the operation idempotent. Never `update users set bytes`.
2. **Postgres is the authority.** Costs, caps, gates and locks live in SQL functions under `supabase/migrations/`. The TypeScript catalogs mirror the numbers for the UI and say so in a comment.
3. **Pure functions for the simulation.** Anything that turns state plus time into new state (`src/lib/economy/tick.ts`, `away.ts`, `forks/mood.ts`, `badges/catalog.ts`) takes no clock and does no I/O, and has a unit test that would fail if the rule changed.
4. **Derive, do not store.** If a value can be computed from what exists (mood, badges due, a pin on the map), compute it.
5. **Whitelist what leaves the server.** Public reads go through a mapper (`src/lib/api/*.ts`) that copies fields out by name. The leak tests in `tests/unit/lib/api/` will fail if you add a field named like something sensitive.
6. **No new dependency for what a few lines can do.** No postprocessing (it cost 40 fps on integrated GPUs), no state library, no icon set.
7. **Migrations are additive and pushed once.** `pnpm db:new <name>`, write the SQL, `pnpm db:push`, `pnpm db:types`, commit all three. Never edit a migration that has been pushed.

## How to add things

**A dialogue line.** `src/lib/forks/mood.ts` holds `MOOD_LINES`, `EVENT_LINES` and `JOB_LINES`; `src/lib/forks/catalog.ts` holds each trait's `lines`. Add a string, keep the voice (dry, short, in-world: Repo, Forks, Maintainer, the 404, never "player" or "game"), run `pnpm test`.

**A Daily Event.** A SQL insert into `daily_events_catalog` in a new migration: `id`, `title`, `narrative`, and two options, each `{label, outcome_text, bytes_delta}` between -25 and +25. Look at `supabase/migrations/*seed_daily_events*.sql` for the shape and the tone.

**A badge.** One entry in `BADGES` in `src/lib/badges/catalog.ts`: an id, a name, a blurb, a kind, an optional byte bonus, and a predicate over `BadgeContext`. If the predicate needs a fact the context does not have, add it to the context and to the home page that builds it. Add a case to `tests/unit/lib/badges/catalog.test.ts`.

**A room.** This one touches four places, on purpose:

1. `supabase/migrations/`: extend the `rooms.kind` check, give `build_room()` a cost.
2. `src/lib/rooms/catalog.ts`: name, cost (mirrored), colour, blurb. `src/lib/forks/jobs.ts`: the job title and what it does.
3. `src/components/scene/rooms/YourRoom.tsx`: the interior, following the [art guide](./docs/art-guide.md) (cell size, walk lane, stations, wall face, warm lamp). Export a `LAYOUT` and a panel anchor; register all three in `rooms/index.tsx`.
4. If the room produces something, extend `Workforce` and `simulate()` in `src/lib/economy/tick.ts` with a rate and a test, and add its read-out to `src/components/rooms/RoomPanels.tsx` and the room page.

Take a screenshot in the corridor and inside the room and attach both to the PR. Walk a Fork through it (assign one from the room page) and watch it for a minute: it must not cross furniture.

## Pull requests

- One change per PR. A room and a rebalance are two PRs.
- The pre-commit hook runs ESLint (with the React Compiler rules) and `tsc`. `pnpm test` must pass; run `pnpm test:integration` if you touched SQL or the ledger.
- Commit messages: `type(scope): what changed`, present tense, and a body that says why. Look at `git log` for the voice. No co-author trailers and no tool attribution; the author is the person who pressed the keys.
- Screenshots for anything visual. Before and after if you changed something that existed.
- No AI-generated dialogue or events. The catalog is written by hand and it reads that way.

## Reporting bugs

Open an issue with what you did, what you expected, what happened, your browser, and, if it is visual, a screenshot. If the bunker is dark, say whether the Power Plant has an engineer; that is a feature.

## Code of conduct

Be the kind of Maintainer the Forks would not gossip about. Disagreement is fine; contempt is not. The maintainer will close what does not fit and say why.
