---
status: draft
target_publish: Friday after post 1
estimated_writing_time: 3h
source_material: analytics schema + Public Alpha health gates + v1.0 gates (Wave 1.B)
---

# Post 2 — "How I designed analytics before any feature"

## Central thesis

Designing the analytics schema and the decision gates before writing the first line of game code forces clarity on what actually matters to measure — and exposes which features are superfluous. Analytics isn't post-launch polish; it's a design instrument.

## Why this post

- Shows engineering rigor + product mindset simultaneously. Real differentiator for senior recruiters.
- Topic rarely covered in game devlogs (most say "I implemented feature X, looks gorgeous"). Editorial differentiation.
- Material 100% ready — comes from the analytics schema, the Public Alpha health gates, and the v1.0 A→C gates produced in Wave 1.B.

## Suggested structure (1000–1500 words)

### Opening — the question nobody asks early
- "Almost every solo dev I see ships the product and THEN asks 'how do I know if it worked?'. Too late."
- "I decided to invert: I defined the analytics schema + decision gates before coding a single line of the game."

### What that means in practice
List of what existed on paper BEFORE any code:

1. **13 canonical events** with snake_case names, typed props, fire moment, target tool.
2. **Closed-typed `track()` helper** — `EventName` as a union literal forces PR review for every new event.
3. **Fan-out**: Umami (cookieless, ready-made dashboards for DAU/retention) + `analytics_events` table in Postgres (custom SQL queries, source of truth for gates).
4. **Privacy guard by construction**: types disallow email/token/IP in props; runtime denylist on the endpoint reinforces it.
5. **Offline queue in IndexedDB**: zero loss in unstable mobile sessions.

### What that unlocked in design
I defined the 6 events of the FTUE funnel:
- `signup_started` → `signup_completed` → `region_chosen` → `first_build` → `first_event_resolved` → `ftue_completed`

And it was only when writing this that I noticed: **`region_chosen` is trivial in the Public Alpha** (only 1 default region). But I kept the event for symmetry with v0.4+ when a 2nd region appears. A schema decision triggered a product decision.

### The gates — health signals, not pivot signals
- **v1.0 gate**: A→C, based on volume + complementary signals (D7 retention, FTUE completion as diagnosis).
- **Public Alpha gates**: continuous, weekly, focused on loop and onboarding. They do NOT trigger a pivot — they tell you what to improve before v1.0.

Table with 3 zones (healthy / concerning / dead) per signal, with action per zone. Example scenarios:
- "FTUE completion ≥ 60% but D7 < 4%" = the game reads well, doesn't play well. Core loop needs more bite.
- "Everything healthy with low volume" = good product, channel problem. Don't touch the game.

### The rule I apply
- Before coding a feature: which event does it emit? Which gate does it move? If neither, rethink.
- If the feature has no clear metric attached, it isn't ready to implement.

### The portfolio gain
- A senior recruiter reads this and sees: this dev does data-driven decisioning from day 1, not as an afterthought.
- ADRs in `/docs/adr/` capturing open decisions (profile-page RLS, Daily Event cardinality) reinforce the signal.

### Closing
"Next Friday I'll design the FTUE — the player's first 10 minutes. Before implementing the bunker."

---

## Bluesky thread hooks (3–5 posts)

1. "Defined analytics + decision gates before coding. Not polish — design. 🧵"
2. "13 canonical events. Closed-typed helper. Every new event passes through a PR that edits the type — forces review."
3. "Writing the FTUE funnel events I noticed `region_chosen` is trivial in the Public Alpha (only 1 region). Kept it for future symmetry. Schema → product decision."
4. "Public Alpha health gates aren't pivot gates. They're diagnosis. 'FTUE ok but D7 dead' = game reads well, doesn't play well."
5. "Rule: a feature with no metric attached isn't ready to implement. [link]"

## Visual to grab attention

- Table of the 13 events (or the 6 FTUE subset) showing name + props.
- TS snippet of `EventPropsMap` showing the `EventName` union literal.
- Table of the 3 zones (healthy/concerning/dead) with 1–2 example rows.

## LinkedIn cross-post

YES — the angle "data-driven decisioning from day 1" is exactly what US recruiters look for.

## What NOT to include

- Operational details of Umami vs Plausible (technical decision to be captured in an ADR later, doesn't belong in the post).
- Implementation code — none exists yet. The point is that **the design exists without the code**.
- Defending the topic "analytics matters" — assume the reader knows; focus on method.
