# Architecture Decision Records

This directory captures architecture and design decisions with long-term consequences. Format follows [Michael Nygard's ADR convention](https://github.com/joelparkerhenderson/architecture-decision-record).

**When to write an ADR:**

- The decision has consequences that are hard to reverse (DB schema, auth choice, public data model).
- There are reasonable alternatives that a reviewer (or future-you in 6 months) will question.
- The decision spans code (it doesn't live in a single file).

**When NOT to write an ADR:**

- A naming convention choice.
- A local decision in a single file.
- A reversible refactor.

## Index

- [0001 — Public profile RLS strategy](./0001-public-profile-rls-strategy.md) — *Proposed* — how `/u/<login>` reads other users' data without breaking RLS.
- [0002 — Daily Event resolution cardinality](./0002-daily-event-resolution-cardinality.md) — *Proposed* — how many Daily Events a user can resolve per day.
- [0003 — Settings: route vs modal](./0003-settings-modal-vs-route.md) — *Proposed* — settings lives at `/settings` or in a modal over `/play`.

## Template

Copy to `NNNN-short-title-in-kebab.md`:

```markdown
# ADR NNNN — <title>

- **Status:** Proposed | Accepted | Deprecated | Superseded by ADR XXXX
- **Decision:** <final decision or TBD with deadline>
- **Related:** <links to GDD, other ADRs, issues>
- **Date:** YYYY-MM-DD

## Context

<the problem, the constraints, what's at stake>

## Options considered

### Option A — <name>

<description>

**Pros:** ...
**Cons:** ...

### Option B — <name>

(same)

## Decision

<which option, or TBD with decision criteria>

## Consequences

<what changes in code, in process, in other ADRs>
```

> **Note:** the long-form design document is kept private as an internal artifact. ADRs in this directory contain the architectural context relevant to readers of the public repo. Each ADR is intended to be self-contained.
