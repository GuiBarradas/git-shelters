# ADR 0002 — Daily Event resolution cardinality per day

- **Status:** Accepted
- **Decision:** Option A — one event per user per UTC day.
- **Date:** 2026-05-03 (proposed), 2026-09-22 (accepted)

## Context

The current schema constraint is `unique(user_id, event_id, date(resolved_at))` on `daily_event_outcomes` — that is, a user **cannot resolve the same event** twice in the same day, but **can resolve different events** in the same day. This is an implicit schema decision that needs to be made explicit: **how many events does a user resolve per day?**

It directly affects:

- **Economic calibration** — outcome bytes × N events/day defines the daily ceiling for this byte source.
- **Content needed** — N events/day × days until the user exhausts the pool and starts repeating.
- **Engagement** — how much "there is to do" each time the user opens the app.
- **Anti-cheese risk** — multiple events = more exploit surface, especially if outcomes deliver guaranteed positive bytes.

The Public Alpha ships with 10–15 hardcoded JSON events. In how many days does a user exhaust the pool?

## Options considered

### Option A — One event per day (total, not per event)

The user resolves **a single** Daily Event per day, picked at random from the pool or rotated.

**Pros:**
- Pure idle — matches the "open, decide, close" tone.
- Trivial calibration: outcome × 1 = daily ceiling.
- A pool of 10–15 events lasts ~2 weeks without repetition.
- Anti-cheese: minimal surface.

**Cons:**
- Lower per-session engagement — a user who opens the app already used today's event, what now?
- Core loop depends heavily on what else exists (build, sync, kudos in later iterations) to justify a second session in the same day.

### Option B — Multiple different events in the same day (current constraint)

The user can resolve up to N different events per day, capped by the eligible pool in the catalog.

**Pros:**
- More content per session.
- Power-gamer users satisfied.

**Cons:**
- A pool of 10–15 events runs out in **a single day** if N is large. The Public Alpha becomes repetitive almost immediately.
- Fragile economic calibration (N × outcome).
- Larger exploit surface (event farming).

### Option C — Hybrid: 1 mandatory + 1 optional unlockable

The user resolves 1 "daily" event always available. A second event appears as "optional" if a condition is met (e.g., 3-day streak, or after `room_built` in that session).

**Pros:**
- Idle for those who want idle, extra content for those who want to engage.
- Streak/conquest hook aligned with the growing daily login bonus already discussed.
- Bonus content gives a reason to come back twice in the same day without becoming a grind.

**Cons:**
- More system to implement — unlock condition needs design + tracking.
- Risk of becoming a "double obligation" for the completionist player (anti-cozy).
- Extra docs/UX.

## Decision

**Option A for the Public Alpha.** Option C stays on the table for a later iteration, gated on D7 retention signal.

Implemented as:

- `daily_event_outcomes` carries a generated `resolved_on` date (UTC) with `unique (user_id, resolved_on)`. `date(resolved_at)` cannot be used directly in a constraint because it depends on the session timezone and is not immutable.
- Which event a user sees is decided in SQL by `pick_daily_event(user_id)`: day N after signup shows the N-th active event ordered by `sort_order`, modulo pool size. Deterministic, so a refresh never changes today's event, and the FTUE event (`sort_order = 0`) is always day 0. The page and the resolve RPC both call it, so the client never chooses which event it resolves.
- `resolve_daily_event(user_id, choice)` logs the outcome snapshot and credits `bytes_delta` through the ledger with `source = 'daily_event'` and the UTC date as `source_ref`. A second call on the same day raises `already_resolved_today`.

Decision criteria:

- The Public Alpha needs to **calibrate first** with a simple source. Option A does that.
- Option C lands when there's more retention signal (D7) — at that point the unlock system becomes an additional hook, not friction.
- Option B is dropped: a pool of 15 events consumed in 1–2 sessions kills the loop before the user comes back for D2.

## Consequences

- Constraint is `unique(user_id, resolved_on)` (no `event_id` mention — forces 1 total event per day).
- Rotation ignores which events the user already resolved. Acceptable while rotation is the only selector; revisit with Option C eligibility conditions.
- **Affected metric:** "return after first event" (Public Alpha health gate) — more conservative under Option A, because the user **cannot** resolve multiple events in the same day, so a return must be on a different day. That is exactly the signal we want.
- **Content needed for the next iteration:** if Option C lands, we must define the unlock condition AND ensure a sufficient pool (catalog grows to ~25–30 events).
- **Economic calibration:** balance docs need to fix "Daily Event = 1 byte source per day, value X bytes" as a reference.
