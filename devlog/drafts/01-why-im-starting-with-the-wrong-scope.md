---
status: draft
target_publish: any Friday
estimated_writing_time: 2h
source_material: scope cut + roadmap recalibration (Wave 1.A)
---

# Post 1 — "Why I'm starting with the wrong scope"

## Central thesis

Defining what "MVP" actually means was the most important product decision so far. Cutting 80% of what looked obligatory (and renaming "shippable MVP" to "Public Alpha") unblocked the possibility of launching. Two weeks before this exercise the roadmap was a 6-month fantasy; after it, a realistic 12–18 month plan.

## Why this post first

- Material 100% ready — comes from the scope-cut diff produced in Wave 1.A.
- Universally relatable theme for devs: "I started off scoping wrong" is shared experience.
- Positions the author as someone who thinks in product, not just code (matters for US recruiters).

## Suggested structure (800–1200 words)

### Opening — the problem
- "I'm building Git Shelters: a browser idle game where your real GitHub activity feeds a post-apocalyptic bunker."
- "Two weeks ago I had a design doc with a 6-month roadmap to v1.0. Today the doc is longer and the roadmap is 12–18 months. I'm closer to launching."

### The insight — "shippable MVP" isn't MVP
- The term "MVP" carries the expectation of "has everything that looks essential". For a part-time solo dev, that's a fatal illusion.
- Renamed to **"Public Alpha"**. Same thing, different word, drastically smaller scope.
- Public Alpha = first public release. Not a reduced v1.0 — it's the leanest thing that proves the concept.

### The cut — bullet by bullet
Honest list of what was in old v0.1 and got cut:
- Workshop, Dorm (2 fewer rooms)
- 2nd Home Region with differentiated aesthetics
- Forks with jobs/moods/death
- Combat
- 404 Lands exploration
- LLM-generated events
- Social world map
- Playable demo mode with sessionStorage

What stayed in the Public Alpha:
- GitHub OAuth login
- R3F bunker with 3 rooms
- Offline catch-up (pure function)
- GitHub sync + "sync now" button
- 1 default Home Region without trade-off
- 10–15 hardcoded JSON Daily Events
- Read-only public profile pages `/u/<username>`
- Read-only demo on the landing
- LGPD-compliant delete/export

### The narrative justification that became lore
"How do I justify shipping with only 1 region without it feeling incomplete?" → it becomes lore, not a hole:

> *"At first, every bunker is the same. The walls are the same, the silence is the same. It's only as you settle in — pick a place, feel the ground — that the region starts to shape it."*

This isn't just copy. It's a principle: **scope cuts done well become part of the narrative**.

### Transferable lesson
- Renaming "MVP" to something less loaded frees you to cut.
- Scope decisions are design decisions, not failures — when done well, they feed the story instead of leaving holes.
- An honest roadmap (12–18 months) is more useful than an ambitious one (6 months) nobody hits.

### Closing
"Next Friday I'll cover how I designed the analytics schema before coding any feature. This is part 1 of a series."

---

## Bluesky thread hooks (3–4 posts)

1. "Two weeks ago my GDD had a 6-month roadmap. Today it has 12–18 months. I'm closer to launching. 🧵"
2. "The problem was the word 'MVP'. It carries the expectation of 'has everything that looks essential'. For a solo dev, that's fatal."
3. "Renamed it 'Public Alpha'. Same thing, different word, drastically smaller scope. [diff screenshot]"
4. "Lesson: scope cuts done well become part of the narrative, not a hole. [link to full post]"

## Visual to grab attention

- Diff screenshot: old v0.1 list (struck through) next to the Public Alpha (clean).
- Pulled quote of the uniform-bunker narrative justification.

## LinkedIn cross-post

YES — strategy/product post, not pure technical. US recruiters read it.

## What NOT to include

- R3F, Supabase, schema technical details. That's post 2.
- Lamenting or "I screwed up" tone. The tone is "I learned and corrected."
- Specific date promises. "12–18 months" is a range, not a commitment.
