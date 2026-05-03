# Git Shelters

> Idle/base-builder where your real GitHub activity feeds a post-apocalyptic bunker.

[![CI](https://github.com/GuiBarradas/git-shelters/actions/workflows/ci.yml/badge.svg)](https://github.com/GuiBarradas/git-shelters/actions/workflows/ci.yml)

Each commit, PR, and issue you author on GitHub generates **Bytes** — the in-game currency you spend to build rooms, recruit Forks (survivors), craft Payload (ammo), and defend your Repo (bunker) against waves of Crawlers (zombie bots) roaming the **404 Lands** since *The Great Merge Conflict*.

This is a side project in pre-production. The full design document is kept private as an internal working artifact. Architectural decisions that affect the public surface — schemas, security boundaries, UX patterns — are captured publicly in [`docs/adr/`](./docs/adr/). Devlog posts in [`devlog/`](./devlog/) explain product decisions in narrative form.

---

## What this project demonstrates

Beyond the game itself, this repo is intentionally built as a portfolio piece. Things to look at:

- **Strict TypeScript** — `strict: true` plus `noUncheckedIndexedAccess`, `noImplicitOverride`, `noFallthroughCasesInSwitch`. No `any` in production code.
- **Tests from commit 1** — Vitest for units, Playwright for the critical paths (auth, sync, persistence). Coverage is not a goal; existence + green CI is.
- **Architecture Decision Records** — non-trivial decisions are documented in [`docs/adr/`](./docs/adr/). See e.g. [ADR 0001 — Public profile RLS strategy](./docs/adr/0001-public-profile-rls-strategy.md).
- **Data-driven product gates** — the analytics schema and the health gates that drive A→C decisions were defined *before* the first feature.
- **Anti-cheese designed up front** — bytes are gated through whitespace/bot/self-star filters, daily caps, and repo-age weighting. Filters live next to the byte source, before crediting.
- **Pre-production devlog** — public from day 1, weekly cadence. Drafts in [`devlog/drafts/`](./devlog/drafts/).
- **LGPD compliance from the Public Alpha** — account delete + data export endpoints, privacy policy, cookieless analytics.

---

## Stack

| Layer | Tech |
|---|---|
| Runtime | Next.js 16 App Router · TypeScript 5 |
| 3D | `@react-three/fiber` · `@react-three/drei` · `@react-three/postprocessing` · Three.js |
| State | Zustand |
| UI | Tailwind v4 · Framer Motion · Lucide |
| Backend | Next API Routes · Supabase (Postgres + Auth + Realtime) · Vercel Cron |
| AI | Gemini 2.5 Flash-Lite (offline batch) |
| Tests | Vitest · Playwright |
| Quality | ESLint · Husky · lint-staged · Sentry |

Cost target: **R$ 0** on free tiers (Vercel + Supabase + Gemini).

Zero external 3D models. All meshes are procedural primitives + a fixed 10-color palette.

---

## Notable design decisions

- **"Public Alpha" instead of "MVP"** — renaming the first public release pushed me to cut 80% of what looked obligatory.
- **Pure function for offline catch-up** — `(last_seen_at, now, rates) → bytes_to_credit`. Testable without mocks, decouples bytes from their source.
- **Source/credit split** for bytes — a future "anonymous mode" can be added without rewriting the core.
- **One Home Region default in Public Alpha** — narrative justification turned a scope cut into lore.
- **Silent tutorial** — no modal-driven tutorial. Arrows + highlights + the game teaches itself.

---

## Running locally

Prerequisites:

- Node 22+
- pnpm 10+ (`npm install -g pnpm` if you don't have it)

```bash
git clone https://github.com/GuiBarradas/git-shelters.git
cd git-shelters
pnpm install
pnpm dev
```

Available scripts:

| Script | What it does |
|---|---|
| `pnpm dev` | Next dev server (Turbopack) |
| `pnpm build` | Production build |
| `pnpm lint` | ESLint |
| `pnpm typecheck` | `tsc --noEmit` |
| `pnpm test` | Vitest (unit) |
| `pnpm test:watch` | Vitest watch mode |
| `pnpm test:e2e` | Playwright (E2E) |

---

## License

This repo is source-available for portfolio review. Contact me before reusing any part of it commercially.

— [Guilherme Martins Barradas](https://github.com/GuiBarradas)
