# ADR 0003 — Settings: dedicated route vs modal

- **Status:** Accepted
- **Decision:** **Option B — dedicated route `/settings`.**
- **Date:** 2026-05-03 (proposed), 2026-09-22 (accepted)

## Context

The Public Alpha has a settings screen with growing scope:

- Account (connected GitHub login, logout, view `github_login`)
- Privacy (public profile toggle, opt-in for private repos in a later iteration)
- Data export (LGPD compliance — right to data portability)
- Data delete (LGPD compliance — right to erasure; destructive flow with two-step confirmation)
- Sessions / devices (future)

The question: does settings live as a **modal over `/play`** or as a **dedicated route `/settings`**?

The choice has consequences for:

- **URL and browser back-button** — is a deep link to "/settings/privacy" ergonomic in a modal? Not natively.
- **Mobile responsiveness** — LGPD requires delete/export to work on any device. An R3F-overlay modal on mobile is fragile; a dedicated route is trivial.
- **Sub-navigation** — settings has 4–5 subsections. A modal needs simulated tabs; a route gets `/settings/account`, `/settings/privacy` etc. natively.
- **Focus and a11y** — a route is a full page with standard HTML semantics. A modal demands a focus trap + correct ARIA modal.
- **Performance** — a modal over `/play` keeps R3F running underneath (cost); a dedicated route lets us unmount the scene.

## Options considered

### Option A — Modal over `/play`

Settings lives as a `<Modal size="lg">` opened over the bunker. Dismissable with Esc/backdrop click.

**Pros:**
- "Doesn't leave the game" — sense of continuity.
- Quick implementation (we already have the `<Modal>` component).
- R3F scene state preserved.

**Cons:**
- LGPD pages embedded in a modal are hostile to screen readers.
- Mobile: a large modal on a small viewport is full-screen anyway — illusory gain.
- No own URL for deep linking or sharing.
- Sub-navigation inside a modal becomes local-state hell.
- R3F keeps consuming GPU/CPU while the user is in settings — wasteful.
- A destructive confirm (delete account) embedded in a modal **inside another context** is confusing.

### Option B — Dedicated route `/settings` (with optional sub-routes)

Settings lives at its own route. Full-screen layout with a side nav (desktop) or tabs/list (mobile). Optional sub-routes: `/settings/account`, `/settings/privacy`, `/settings/data`.

**Pros:**
- Own URL — back-button works, deep link works.
- Trivial mobile responsive — it's just a page.
- Sub-navigation with Next.js routing (App Router) is native.
- A11y: standard HTML semantics, no custom focus trap.
- R3F scene unmounts — saves resources.
- A destructive confirm (delete) gets its own page with the appropriate "this is a different path from the game" tone.
- A recruiter opening the repo sees a clean structure: `app/play`, `app/settings`, `app/u/[login]`.

**Cons:**
- "Leaves the game" — a small loss of continuity.
- Slightly more implementation (own layout, nav, breadcrumb).
- R3F scene re-mounts on return (a few hundred ms cost).

### Option C — Small modal for quick actions + route for heavy actions

Hybrid: modal for "logout" and "see GitHub account" (1–2 clicks); route for delete/export/privacy (real sub-navigation).

**Pros:**
- Each path uses the right pattern.

**Cons:**
- Two entry points for "settings" confuse the user.
- Cost of maintaining two patterns for the same feature.
- Unnatural — users think of settings as "one thing", not two.

## Decision

**Option B.** `/settings` shipped on 2026-09-22 with the two LGPD controls (ADR 0007). It is a plain server-rendered route with forms; no modal, no client state.

Criteria:
- LGPD requires compliance on any device → mobile responsive is a hard requirement → a route is the path of least resistance.
- A11y baseline (focus, ARIA) is cheaper on a route than on a modal.
- "Leaving the game" is acceptable cost; a user changing settings is already out of the gameplay flow.
- Option C is tempting but violates the principle that the Public Alpha uses only 2 UI patterns (modal + dedicated route).

## Consequences

- **If Option B:**
  - Next.js App Router structure: `app/settings/page.tsx` + `app/settings/account/page.tsx` etc.
  - Dedicated layout `app/settings/layout.tsx` with side nav (desktop) / tabs (mobile).
  - **Only** "Confirm logout" remains a modal — atomic 1-click action available from any screen.
  - R3F scene unmounted on entry to `/settings`. Re-mounted on return.
  - The "Settings" HUD item in `/play` does `router.push('/settings')`, not `setSettingsOpen(true)`.
- **If Option A (decision reversed):**
  - LGPD pages (privacy/terms) would still need to live outside the modal for accessibility — `/legal/*` routes stay.
  - Risk of rework when later iterations add more sub-settings.
- **Affected metric:** none from the Public Alpha health gates. This is a UX/architecture decision, not a product one.
- **Recruiter signal:** a dedicated route reads cleaner in the `app/` tree. Marginal but consistent with treating the README and repo structure as a portfolio piece.
