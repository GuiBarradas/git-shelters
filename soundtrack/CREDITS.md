# Soundtrack credits

Reference tracks for in-game radio (**Static FM** — synthwave/lo-fi station inside the bunker).

All tracks below are believed to be CC0 / royalty-free, sourced from public asset libraries. Each entry lists the author handle, source platform, original URL, and date downloaded — kept for traceability even though CC0 does not strictly require attribution.

If any track here is mislicensed or you are the author and want it removed, please open an issue.

## Tracks

| Filename | Author / handle | Source | Original URL | Downloaded | License |
|---|---|---|---|---|---|
| `delosound-synthwave-retro-80s-321106.mp3` | delosound | Pixabay (TBC) | TBC | 2026-?? | CC0 (TBC) |
| `fidelfortune-cyberpunk-synthwave-351505.mp3` | fidelfortune | Pixabay (TBC) | TBC | 2026-?? | CC0 (TBC) |
| `lnplusmusic-synthwave-80s-retro-background-music-400483.mp3` | lnplusmusic | Pixabay (TBC) | TBC | 2026-?? | CC0 (TBC) |
| `lofidreams-midnight-run-90x27s-vaporwave-lofi-366805.mp3` | lofidreams | Pixabay (TBC) | TBC | 2026-?? | CC0 (TBC) |
| `monume-synthwave-retro-80s-498055.mp3` | monume | Pixabay (TBC) | TBC | 2026-?? | CC0 (TBC) |
| `monume-synthwave-retro-80s-519247.mp3` | monume | Pixabay (TBC) | TBC | 2026-?? | CC0 (TBC) |
| `slimeyfox-ghost-in-the-machine-487284.mp3` | slimeyfox | Pixabay (TBC) | TBC | 2026-?? | CC0 (TBC) |
| `turtlebeats-dark-synthwave-neon-nights-251682.mp3` | turtlebeats | Pixabay (TBC) | TBC | 2026-?? | CC0 (TBC) |

> **TBC** = to be confirmed. Verify each row against your download history and replace before the first public release.

## Source platforms used

- [Pixabay Music](https://pixabay.com/music/)
- [OpenGameArt](https://opengameart.org)
- [Freesound](https://freesound.org)

## When implementing Static FM (later in the roadmap)

These files are kept here as **source / reference**. They are not served from `public/` — that would bloat Vercel deployments and burn free-tier bandwidth.

Migration plan when Static FM ships:

1. Upload final selection to **Supabase Storage** (or R2 / S3) with a public bucket.
2. Reference via signed URL or public CDN URL from the client.
3. Add an ADR documenting the choice of storage provider and caching strategy.
4. Add a `soundtrack/MANIFEST.json` listing each track's title, author, duration, and CDN URL — fetched at runtime by the radio component.
