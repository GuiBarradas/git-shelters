# ADR 0008 — Analytics: server-side events only

- **Status:** Accepted
- **Decision:** A closed, typed set of product events written from server code into `analytics_events`. No third-party analytics, no client SDK, no offline queue. Session end is the one client touchpoint, sent as a beacon.
- **Related:** [ADR 0007](./0007-lgpd-account-export-and-deletion.md)
- **Date:** 2026-09-22

## Context

The Public Alpha's health gates and the later "keep or pivot" decision depend on a handful of numbers: how many sign-ups reach a first build and a first Daily Event, how fast, and whether people come back. That needs a durable, queryable event log the maintainer owns. The design doc sketched a two-sink setup (self-hosted Umami plus an `analytics_events` table) fed by a client-side `track()` with an IndexedDB retry queue.

## Options considered

### A — Two sinks: Umami dashboards plus `analytics_events`, client-side `track()` with offline queue

Ready-made dashboards for DAU and retention. But: a second service to host and keep up, a client bundle, a cookie/consent question to answer, PII guarding at a public endpoint, and an offline queue to test. For dozens of users in an alpha, the dashboards would show numbers you can get from one SQL query.

### B — `analytics_events` only, written server-side where the action already happens

Every gate event has a server touchpoint we own: the OAuth callback (signup), the build and resolve Server Actions, the authenticated page render (session start). Writing from there means typed props by construction, no public analytics endpoint, no consent banner, and nothing to lose offline because the write happens next to the database write it describes. Session end is the exception: only the browser knows when the tab goes away, so a `sendBeacon` to an authenticated route covers it.

### C — Nothing until there are users

Cheapest, but the gates need data from day one; retrofitting loses the first cohort, which is the one that matters.

→ **Decision: B.** Umami or Plausible can be added on top later as a dashboard layer; the table is the source of truth either way.

## Events shipped

`signup_completed`, `region_chosen` (auto-default, kept for symmetry), `first_build`, `room_built`, `first_event_resolved`, `daily_event_resolved`, `session_start` (throttled to one per 30 minutes per user, derived from the previous row), `session_end` (beacon, duration bounded to 24 h). Cohort retention is a query over `session_start` and `users.created_at`, not an event.

Not shipped, with the reason: `landing_visited` and `profile_page_visited` are pageviews with no server user and would need the client layer; `sync_now_clicked` and `bytes_credited` are not read by any gate; `ftue_completed` is derivable from the four milestones.

## Privacy

- `user_id` is our uuid, never the GitHub id. No prop type admits an email, token or IP.
- `analytics_events.user_id` is `ON DELETE SET NULL`: account deletion keeps the aggregate row and removes the person. The rows are included in the LGPD export while the account exists.
- No cookie beyond the session, so no consent banner (ADR 0007 stands).

## Consequences

- Migration `init_analytics_events`: table, two indexes (per user and per event over time), RLS with no policies, `service_role` grant.
- `lib/analytics/track.ts`: `AnalyticsEvent` map, `track()`, `trackSessionStart()`, `isFirst()`. Failures are reported to Sentry as warnings and never thrown.
- Call sites: `app/auth/callback/route.ts`, `app/rooms/actions.ts`, `app/events/actions.ts`, `app/page.tsx` (via `after()`), `components/analytics/SessionBeacon.tsx` → `app/api/analytics/session-end/route.ts`.
- `exportAccount` includes the user's events; the account integration test asserts anonymisation after deletion.
- A 13-month purge job and any dashboard layer are future work, tracked when volume or a reader justifies them.
