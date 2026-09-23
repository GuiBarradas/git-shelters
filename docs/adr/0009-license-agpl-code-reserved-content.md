# ADR 0009 — License: AGPL-3.0 for the code, all rights reserved for the content

- **Status:** Accepted
- **Decision:** The source code is licensed under the GNU Affero General Public License v3.0 only. The game's content — its name, the setting, the names of places, survivors, traits and rooms, the Daily Event catalog and every other piece of narrative text, and the visual identity — is not licensed and stays with the author.
- **Date:** 2026-09-23

## Context

The repository is public by design: it is a portfolio piece as much as a game. Until now the README said "source-available for portfolio review, contact me before reusing commercially" and `package.json` declared no license at all. Legally that is "all rights reserved" with the code on display; practically it is ambiguous, and it is not open source.

A license says what other people may do with this work. It does not shield the author from claims about anyone else's work; that question is answered by the game's own art, names and text, which are original (see the design doc on vocabulary and palette).

## Options considered

### A — Keep source-available, no OSI license

Full control. But the wording invites questions from every reader, contributions are legally murky, and the project cannot call itself open source.

### B — MIT

Simple and permissive. Anyone can take the code, host a copy under any name, keep their changes closed, and sell it. For a live service that is the whole product, that is the failure mode we care about most.

### C — AGPL-3.0 for the code, content reserved

Anyone can read, run, fork and improve the code, but whoever hosts a modified copy as a service must publish their source under the same terms. Closed clones are off the table. Separating the content keeps the world itself with the author: the code is free, the Repo is not. This is the shape most open-source games use, and the one Git City, the closest reference in the niche, chose.

## Decision

C. `LICENSE` carries the AGPL-3.0 text, `package.json` declares `AGPL-3.0-only`, and the README states the split in plain words.

## Consequences

- Contributions arrive under AGPL-3.0 by default; no CLA.
- A fork that changes the game must ship its source. A fork that reuses the name, the setting or the event texts needs permission regardless of the license.
- The design document stays private and unlicensed; it is not part of the repository.
- If a commercial path ever needs a different license, the author can relicense their own contributions; third-party contributions would need their authors' consent. Keeping the contributor list short keeps that option open.
