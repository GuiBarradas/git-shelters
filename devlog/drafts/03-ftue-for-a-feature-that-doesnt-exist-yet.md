---
status: ready (FTUE timeline + UI hierarchy designed)
target_publish: Friday after post 2
estimated_writing_time: 3h
source_material: FTUE timeline + UI hierarchy
---

# Post 3 — "FTUE for a feature that doesn't exist yet"

## Central thesis

Designing the player's first 10 minutes (FTUE = First Time User Experience) before implementing the bunker forces clarity on which systems must exist on Day 1. It inverts the default loop of "I build features, then I bolt a tutorial on top".

## Suggested structure (1000–1500 words)

### Opening — the inversion
- Industry default: implement features → add tutorial → realize the tutorial doesn't fit → rewrite features.
- Inversion: design tutorial first → tutorial defines the minimum features needed → implement only what's needed.

### The 10 minutes, in detail
- Second by second, with exact copy, target emotional state, analytics event fired, and fallback if something fails.
- Each FTUE step maps to 1 event of the funnel defined in post 2 (`signup_completed` → `region_chosen` → `first_build` → `first_event_resolved` → `ftue_completed`).

### Concrete example — the FTUE Daily Event
The first Daily Event is hardcoded fixed (`ftue_first_event_static_1` "Strange Packet at the Door"). Pulled quote of the actual narrative + 2 outcomes. This single event renders better in screenshot/quote than any abstract description.

### The silent tutorial
- No "PRESS X TO CONTINUE" modals. Arrows + highlights + the game teaches itself.
- Reference: Stardew Valley's first 10 minutes, not a 2010s MMO.
- Why this matters for cozy/idle tone: the tutorial *is* the game already.

### What the exercise revealed
- Some "essential" feature became superfluous when viewed inside the first 10 minutes (e.g., 2nd Home Region — kept for a later iteration instead of the Public Alpha).
- Some feature I'd ignored became critical (offline catch-up — without it, day-2 return is broken).
- `region_chosen` analytics event is trivial in Public Alpha (only 1 region) but kept for funnel symmetry — same pattern from post 2.

### The rule I apply now
- Every scope decision goes through the filter: "does this appear in the first 10 minutes? If not, is it really Public Alpha material?"
- FTUE is the product in the Public Alpha. Anything that doesn't serve the first 10 minutes is a candidate to cut.

### Closing
"Part 3 of a pre-production series. Next Friday I start turning all of this into code."

---

## Bluesky thread hooks

1. "I designed my game's first 10 minutes before implementing the bunker. 🧵"
2. "The first Daily Event is hardcoded — same copy for every player. Why? So I can review it. Pulled quote: [Strange Packet at the Door]."
3. "Silent tutorial: no modals, no 'PRESS X'. Arrows, highlights, and the game teaches itself. Stardew, not MMO."
4. "Cut 2nd region from Public Alpha. Justified narratively: 'at first, every bunker is the same'. Lore, not hole."
5. "Rule: if a feature doesn't appear in the first 10 minutes, is it really Public Alpha material?"

## Visual to grab attention

- Visual timeline of the 10 minutes with analytics events annotated.
- Pulled quote of "Strange Packet at the Door" — the FTUE event narrative.
- Screenshot/mockup (paper prototype OK) of 1–2 key screens.

## LinkedIn cross-post

LIKELY YES — the "process inversion" thesis resonates outside the gamedev bubble.

## TODO before writing

- [ ] Pull "Strange Packet at the Door" copy from the FTUE timeline and decide which outcome to highlight.
- [ ] At least 1 ugly mockup to illustrate (paper prototype or basic wireframe).
- [ ] Pick 2 screens to wireframe (likely landing and post-FTUE main HUD).
